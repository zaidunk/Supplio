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
    const requestId = await insertRequest(db, {
      businessId,
      restockBudget: business.defaultRestockBudget, // snapshot; perubahan setting tidak memengaruhi request ini
      aiSettingsVersion: aiSettings?.version ?? 1,
      triggerKey,
      expiresAt,
      triggerSource: "AUTO",
      reason: "Trigger restock otomatis",
      items: triggered.map(({ product, requiredQuantity }) => ({
        productId: product.id,
        requiredQuantity: requiredQuantity.toString(), // snapshot untuk audit
        maxDeliveryDays: product.plannedLeadTimeDays ?? 0, // default = plannedLeadTimeDays (§4.1)
        allowedOverbuyQuantity: product.allowedOverbuyQuantity.toString(),
      })),
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

interface InsertRequestInput {
  businessId: string;
  restockBudget: number;
  aiSettingsVersion: number;
  triggerKey: string;
  expiresAt: Date;
  triggerSource: "AUTO" | "MANUAL";
  reason: string;
  items: { productId: string; requiredQuantity: string; maxDeliveryDays: number; allowedOverbuyQuantity: string }[];
}

/** Request DRAFT + item + riwayat transisi awal dalam satu transaksi; dipakai jalur otomatis dan manual. */
async function insertRequest(db: PrismaClient, input: InsertRequestInput): Promise<string> {
  return db.$transaction(async (tx) => {
    const request = await tx.procurementRequest.create({
      data: {
        businessId: input.businessId,
        restockBudget: input.restockBudget,
        status: "DRAFT",
        triggerSource: input.triggerSource,
        aiSettingsVersion: input.aiSettingsVersion,
        triggerKey: input.triggerKey,
        expiresAt: input.expiresAt,
      },
      select: { id: true },
    });
    await tx.procurementRequestItem.createMany({
      data: input.items.map((item) => ({ requestId: request.id, businessId: input.businessId, ...item })),
    });
    await tx.procurementStatusTransition.create({
      data: { requestId: request.id, fromStatus: null, toStatus: "DRAFT", reason: input.reason },
    });
    return request.id;
  });
}

export interface ManualRequestInput {
  businessId: string;
  /** Kunci per percobaan kirim dari form: klik ganda/retry jaringan tidak membuat request ganda. */
  clientKey: string;
  items: { productId: string; quantity: string; maxDeliveryDays?: number }[];
  expiryHours: number;
  now?: Date;
}

export type ManualRequestOutcome = Extract<EvaluateOutcome, { outcome: "CREATED" | "EXISTING" }>;

/**
 * Permintaan penawaran manual oleh owner (SUPPLIO.md §4.1): barang yang dipilih ikut request walau belum mencapai
 * reorder point, dengan kuantitas yang owner tentukan. Aturan lain tetap sama dengan jalur otomatis: budget terisi,
 * supplier aktif ada, dan hanya satu proses sourcing aktif per bisnis. Berbeda dari otomatis, bentrok dengan
 * sourcing aktif DITOLAK (409) agar owner tahu, bukan ditunda diam-diam.
 */
export async function createManualRequest(db: PrismaClient, input: ManualRequestInput): Promise<ManualRequestOutcome> {
  const { businessId, clientKey, expiryHours } = input;
  const triggerKey = buildTriggerKey(businessId, `manual:${clientKey}`);

  const replay = await db.procurementRequest.findUnique({ where: { triggerKey }, select: { id: true } });
  if (replay) return { outcome: "EXISTING", requestId: replay.id };

  if (input.items.length === 0) throw new DomainError("NO_ITEMS", "Pilih minimal satu barang.");
  const productIds = input.items.map((i) => i.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new DomainError("DUPLICATE_PRODUCT", "Satu barang hanya boleh muncul sekali dalam permintaan.");
  }

  const business = await db.business.findUnique({ where: { id: businessId }, select: { defaultRestockBudget: true } });
  if (!business) throw new DomainError("BUSINESS_NOT_FOUND", "Bisnis tidak ditemukan.", 404);
  if (business.defaultRestockBudget <= 0) {
    throw new DomainError("RESTOCK_BUDGET_NOT_SET", "Restock Budget belum diatur. Isi dulu di Settings.", 409);
  }

  const products = await db.product.findMany({
    where: { businessId, id: { in: productIds } },
    select: {
      id: true,
      name: true,
      quantityScale: true,
      plannedLeadTimeDays: true,
      allowedOverbuyQuantity: true,
      _count: { select: { supplierProducts: { where: { supplier: { isActive: true } } } } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const items: InsertRequestInput["items"] = [];
  for (const item of input.items) {
    const product = byId.get(item.productId);
    if (!product) throw new DomainError("PRODUCT_NOT_FOUND", "Produk tidak ditemukan.", 404);
    if (product._count.supplierProducts === 0) {
      throw new DomainError("NO_ACTIVE_SUPPLIER", `${product.name}: belum ada supplier aktif.`, 409);
    }
    const quantity = new Decimal(item.quantity);
    if (!quantity.gt(0)) throw new DomainError("INVALID_QUANTITY", `${product.name}: jumlah harus lebih dari 0.`);
    if (quantity.decimalPlaces() > product.quantityScale) {
      throw new DomainError(
        "QUANTITY_SCALE_EXCEEDED",
        `${product.name}: satuan ini hanya mengizinkan ${product.quantityScale} desimal.`,
      );
    }
    const maxDeliveryDays = item.maxDeliveryDays ?? product.plannedLeadTimeDays;
    if (maxDeliveryDays === null) {
      throw new DomainError("MAX_DELIVERY_DAYS_REQUIRED", `${product.name}: isi batas hari kedatangan (lead time belum diatur).`);
    }
    items.push({
      productId: product.id,
      requiredQuantity: quantity.toString(), // snapshot: jumlah yang owner setujui untuk diminta
      maxDeliveryDays,
      allowedOverbuyQuantity: product.allowedOverbuyQuantity.toString(),
    });
  }

  const activeError = async () => {
    const active = await findActiveSourcing(db, businessId);
    return active
      ? new DomainError(
          "ACTIVE_SOURCING_EXISTS",
          "Masih ada proses sourcing aktif. Selesaikan atau batalkan dulu di halaman Procurement sebelum meminta penawaran baru.",
          409,
        )
      : null;
  };
  const blocked = await activeError();
  if (blocked) throw blocked;

  const aiSettings = await db.aISettings.findFirst({
    where: { businessId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const now = input.now ?? new Date();

  try {
    const requestId = await insertRequest(db, {
      businessId,
      restockBudget: business.defaultRestockBudget,
      aiSettingsVersion: aiSettings?.version ?? 1,
      triggerKey,
      expiresAt: new Date(now.getTime() + expiryHours * 3_600_000),
      triggerSource: "MANUAL",
      reason: "Diminta manual oleh owner",
      items,
    });
    return { outcome: "CREATED", requestId, productIds, issues: [] };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const again = await db.procurementRequest.findUnique({ where: { triggerKey }, select: { id: true } });
    if (again) return { outcome: "EXISTING", requestId: again.id };
    const raced = await activeError();
    if (raced) throw raced;
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
