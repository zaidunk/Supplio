import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import type { PrismaClient } from "@/generated/prisma/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { DomainError } from "@/lib/errors";
import { getIncomingQuantities } from "@/lib/inventory/incoming";
import { computeRestock, type PlanningField } from "@/lib/inventory/restock";
import { SOURCING_ACTIVE_STATUSES } from "./lifecycle";

export type RestockIssue =
  | { scope: "business"; code: "RESTOCK_BUDGET_NOT_SET" }
  | { scope: "product"; code: "PLANNING_CONFIG_MISSING"; productId: string; productName: string; missing: PlanningField[] }
  | { scope: "product"; code: "NO_ACTIVE_SUPPLIER"; productId: string; productName: string };

export type EvaluateOutcome =
  /** Konfigurasi wajib belum lengkap: tidak ada request dan AI tidak dipanggil (§4.1). */
  | { outcome: "CONFIGURATION_REQUIRED"; issues: RestockIssue[] }
  /** Tidak ada barang yang memerlukan restock (atau sudah tercakup request aktif). */
  | { outcome: "NOT_NEEDED"; issues: RestockIssue[] }
  /** Ada kebutuhan baru tetapi satu proses sourcing aktif masih berjalan; dievaluasi ulang nanti (§4.1). */
  | { outcome: "DEFERRED"; activeRequestId: string; pendingProductIds: string[]; issues: RestockIssue[] }
  /** Evaluasi yang sama sudah pernah diproses (replay idempotent). */
  | { outcome: "EXISTING"; requestId: string }
  | { outcome: "CREATED"; requestId: string; productIds: string[]; issues: RestockIssue[] };

export interface EvaluateInput {
  businessId: string;
  /**
   * Kunci idempotensi satu peristiwa pemicu (mis. id movement, `product:<id>:<updatedAt>`).
   * Pengulangan peristiwa yang sama → request yang sama, tidak pernah ganda.
   */
  evaluationKey: string;
  /** Masa berlaku request (jam); dari PROCUREMENT_REQUEST_EXPIRY_HOURS. */
  expiryHours: number;
  now?: Date;
}

export const buildTriggerKey = (businessId: string, evaluationKey: string): string =>
  createHash("sha256").update(`${businessId}:${evaluationKey}`).digest("hex");

/**
 * Evaluasi inventaris satu bisnis dan, bila perlu, buat SATU ProcurementRequest berisi seluruh barang
 * yang memenuhi trigger (§4.1). Aman dipanggil berulang dan paralel:
 *  - replay peristiwa sama → `triggerKey` unik;
 *  - dua evaluasi berbeda yang berlomba → index unik parsial "satu sourcing aktif per bisnis" di DB.
 */
export async function evaluateRestock(db: PrismaClient, input: EvaluateInput): Promise<EvaluateOutcome> {
  const { businessId, evaluationKey, expiryHours } = input;
  const now = input.now ?? new Date();
  const triggerKey = buildTriggerKey(businessId, evaluationKey);

  const replay = await db.procurementRequest.findUnique({ where: { triggerKey }, select: { id: true } });
  if (replay) return { outcome: "EXISTING", requestId: replay.id };

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { defaultRestockBudget: true },
  });
  if (!business) throw new DomainError("BUSINESS_NOT_FOUND", "Bisnis tidak ditemukan.", 404);

  const [products, incoming] = await Promise.all([
    db.product.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        quantityScale: true,
        currentStock: true,
        dailyConsumption: true,
        manualThreshold: true,
        plannedLeadTimeDays: true,
        safetyStock: true,
        targetCoverageDays: true,
        allowedOverbuyQuantity: true,
        _count: { select: { supplierProducts: { where: { supplier: { isActive: true } } } } },
      },
    }),
    getIncomingQuantities(db, businessId),
  ]);

  const issues: RestockIssue[] = [];
  const triggered: { product: (typeof products)[number]; requiredQuantity: Decimal }[] = [];

  for (const product of products) {
    const evaluation = computeRestock({
      currentStock: product.currentStock,
      incomingQuantity: incoming.get(product.id) ?? new Decimal(0),
      manualThreshold: product.manualThreshold,
      safetyStock: product.safetyStock,
      quantityScale: product.quantityScale,
      dailyConsumption: product.dailyConsumption,
      plannedLeadTimeDays: product.plannedLeadTimeDays,
      targetCoverageDays: product.targetCoverageDays,
    });

    if (evaluation.status === "CONFIGURATION_REQUIRED") {
      issues.push({
        scope: "product",
        code: "PLANNING_CONFIG_MISSING",
        productId: product.id,
        productName: product.name,
        missing: evaluation.missing,
      });
      continue;
    }
    if (!evaluation.triggerRestock) continue;

    if (product._count.supplierProducts === 0) {
      issues.push({ scope: "product", code: "NO_ACTIVE_SUPPLIER", productId: product.id, productName: product.name });
      continue;
    }
    triggered.push({ product, requiredQuantity: evaluation.requiredQuantity });
  }

  if (business.defaultRestockBudget <= 0) {
    issues.push({ scope: "business", code: "RESTOCK_BUDGET_NOT_SET" });
    if (triggered.length > 0) return { outcome: "CONFIGURATION_REQUIRED", issues };
  }

  if (triggered.length === 0) {
    // Budget kosong saja bukan masalah bila memang tidak ada yang perlu dibeli.
    const productIssues = issues.some((i) => i.scope === "product");
    return { outcome: productIssues ? "CONFIGURATION_REQUIRED" : "NOT_NEEDED", issues };
  }

  const active = await findActiveSourcing(db, businessId);
  if (active) return deferOrCovered(active, triggered, issues);

  const aiSettings = await db.aISettings.findFirst({
    where: { businessId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const expiresAt = new Date(now.getTime() + expiryHours * 3_600_000);

  try {
    const requestId = await db.$transaction(async (tx) => {
      const request = await tx.procurementRequest.create({
        data: {
          businessId,
          restockBudget: business.defaultRestockBudget, // snapshot; perubahan setting tidak memengaruhi request ini
          status: "DRAFT",
          aiSettingsVersion: aiSettings?.version ?? 1,
          triggerKey,
          expiresAt,
        },
        select: { id: true },
      });
      await tx.procurementRequestItem.createMany({
        data: triggered.map(({ product, requiredQuantity }) => ({
          requestId: request.id,
          businessId,
          productId: product.id,
          requiredQuantity: requiredQuantity.toString(), // snapshot untuk audit
          maxDeliveryDays: product.plannedLeadTimeDays ?? 0, // default = plannedLeadTimeDays (§4.1)
          allowedOverbuyQuantity: product.allowedOverbuyQuantity,
        })),
      });
      await tx.procurementStatusTransition.create({
        data: { requestId: request.id, fromStatus: null, toStatus: "DRAFT", reason: "Trigger restock otomatis" },
      });
      return request.id;
    });
    return { outcome: "CREATED", requestId, productIds: triggered.map((t) => t.product.id), issues };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Kalah balapan: replay peristiwa yang sama, atau proses sourcing lain baru saja dimulai.
    const again = await db.procurementRequest.findUnique({ where: { triggerKey }, select: { id: true } });
    if (again) return { outcome: "EXISTING", requestId: again.id };
    const raced = await findActiveSourcing(db, businessId);
    if (raced) return deferOrCovered(raced, triggered, issues);
    throw e;
  }
}

async function findActiveSourcing(db: PrismaClient, businessId: string) {
  return db.procurementRequest.findFirst({
    where: { businessId, status: { in: [...SOURCING_ACTIVE_STATUSES] } },
    select: { id: true, items: { select: { productId: true } } },
  });
}

/** Barang yang sudah ada di request aktif dianggap tercakup; sisanya ditandai untuk evaluasi berikutnya. */
function deferOrCovered(
  active: { id: string; items: { productId: string }[] },
  triggered: { product: { id: string } }[],
  issues: RestockIssue[],
): EvaluateOutcome {
  const covered = new Set(active.items.map((i) => i.productId));
  const pendingProductIds = triggered.map((t) => t.product.id).filter((id) => !covered.has(id));
  if (pendingProductIds.length === 0) return { outcome: "NOT_NEEDED", issues };
  return { outcome: "DEFERRED", activeRequestId: active.id, pendingProductIds, issues };
}
