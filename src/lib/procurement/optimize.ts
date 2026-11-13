import type { PrismaClient } from "@/generated/prisma/client";
import type { Db } from "@/lib/db/types";
import { DomainError } from "@/lib/errors";
import { solveProcurement } from "@/lib/optimization/solve";
import type { OptimizerInput, OptimizerResult, OptimizerQuotation } from "@/lib/optimization/types";
import { transitionRequestTx } from "./transition";

/**
 * Memuat masukan optimizer dari PostgreSQL untuk SATU request milik `businessId` (SUPPLIO.md §6, §10 langkah 6).
 *  - Hanya penawaran CONFIRMED dari supplier aktif pada sesi request ini; yang DRAFT/NEEDS_CLARIFICATION,
 *    REJECTED, dan EXPIRED tidak pernah sampai ke solver. Supplier yang tidak membalas tidak dianggap
 *    menawarkan harga referensi.
 *  - Bila satu supplier punya beberapa penawaran CONFIRMED, yang terbaru (confirmedAt) yang dipakai.
 *  - Batas harga maksimum memakai nilai produk SAAT INI; budget memakai snapshot request.
 */
export async function loadOptimizerInput(
  db: Db,
  businessId: string,
  requestId: string,
  now: Date,
): Promise<OptimizerInput> {
  const request = await db.procurementRequest.findFirst({
    where: { id: requestId, businessId },
    select: {
      restockBudget: true,
      items: {
        select: {
          productId: true,
          requiredQuantity: true,
          maxDeliveryDays: true,
          allowedOverbuyQuantity: true,
          product: { select: { name: true, unit: true, quantityScale: true, maximumUnitPrice: true } },
        },
      },
    },
  });
  if (!request) throw new DomainError("REQUEST_NOT_FOUND", "Procurement request tidak ditemukan.", 404);

  const confirmed = await db.quotation.findMany({
    where: { status: "CONFIRMED", session: { requestId, businessId }, supplier: { isActive: true } },
    orderBy: [{ confirmedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: {
      id: true,
      supplierId: true,
      status: true,
      shippingFee: true,
      leadTimeDays: true,
      validUntil: true,
      supplier: { select: { name: true } },
      items: {
        select: {
          id: true,
          productId: true,
          quotedUnitPrice: true,
          availableQuantity: true,
          minimumOrderQuantity: true,
          packSize: true,
        },
      },
    },
  });

  const latestPerSupplier = new Map<string, (typeof confirmed)[number]>();
  for (const q of confirmed) if (!latestPerSupplier.has(q.supplierId)) latestPerSupplier.set(q.supplierId, q);

  const quotations: OptimizerQuotation[] = [...latestPerSupplier.values()].map((q) => ({
    quotationId: q.id,
    supplierId: q.supplierId,
    supplierName: q.supplier.name,
    status: q.status,
    shippingFee: q.shippingFee,
    leadTimeDays: q.leadTimeDays,
    validUntil: q.validUntil,
    items: q.items.map((i) => ({
      quotationItemId: i.id,
      productId: i.productId,
      quotedUnitPrice: i.quotedUnitPrice,
      availableQuantity: i.availableQuantity?.toString() ?? null,
      minimumOrderQuantity: i.minimumOrderQuantity.toString(),
      packSize: i.packSize?.toString() ?? null,
    })),
  }));

  return {
    restockBudget: request.restockBudget,
    now,
    quotations,
    items: request.items.map((i) => ({
      productId: i.productId,
      productName: i.product.name,
      unit: i.product.unit,
      quantityScale: i.product.quantityScale,
      requiredQuantity: i.requiredQuantity.toString(),
      allowedOverbuyQuantity: i.allowedOverbuyQuantity.toString(),
      maxDeliveryDays: i.maxDeliveryDays,
      maximumUnitPrice: i.product.maximumUnitPrice,
    })),
  };
}

export interface OptimizationRun {
  recommendationId: string;
  requestStatus: "AWAITING_APPROVAL" | "NO_FEASIBLE_SOLUTION";
  result: Exclude<OptimizerResult, { status: "ERROR" }>;
}

/**
 * Jalankan optimizer untuk request berstatus OPTIMIZING, simpan rekomendasi, dan pindahkan status:
 *   OPTIMAL → AWAITING_APPROVAL (belum ada komitmen order) · tidak feasible → NO_FEASIBLE_SOLUTION.
 * Berjalan dalam satu transaksi dengan kunci baris pada request: dua eksekusi bersamaan tidak membuat dua
 * rekomendasi, dan eksekusi terlambat pada status lain ditolak (tidak memundurkan status). Hasil solver yang
 * gagal validasi (`ERROR`) tidak pernah disimpan.
 */
export async function runOptimization(
  db: PrismaClient,
  params: { businessId: string; requestId: string; now?: Date },
): Promise<OptimizationRun> {
  const { businessId, requestId } = params;
  const now = params.now ?? new Date();

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ProcurementRequest" WHERE id = ${requestId} AND "businessId" = ${businessId} FOR UPDATE`;
    const current = await tx.procurementRequest.findFirst({ where: { id: requestId, businessId }, select: { status: true } });
    if (!current) throw new DomainError("REQUEST_NOT_FOUND", "Procurement request tidak ditemukan.", 404);
    if (current.status !== "OPTIMIZING") {
      throw new DomainError("REQUEST_NOT_OPTIMIZING", `Optimasi hanya untuk request OPTIMIZING (status sekarang ${current.status}).`, 409);
    }

    const input = await loadOptimizerInput(tx, businessId, requestId, now);
    const result = solveProcurement(input);
    if (result.status === "ERROR") {
      const codes = result.violations?.map((v) => v.code).join(", ");
      throw new DomainError("OPTIMIZER_ERROR", `${result.message}${codes ? ` (${codes})` : ""}`, 500);
    }

    const optimal = result.status === "OPTIMAL";
    const recommendation = await tx.procurementRecommendation.create({
      data: {
        requestId,
        totalCost: optimal ? result.totalCost : 0,
        remainingBudget: optimal ? result.remainingBudget : input.restockBudget,
        solverStatus: result.status,
        explanation: result.explanationLines.join("\n"),
      },
      select: { id: true },
    });

    if (optimal) {
      await tx.recommendationSupplier.createMany({
        data: result.suppliers.map((s) => ({ recommendationId: recommendation.id, supplierId: s.supplierId, shippingFee: s.shippingFee })),
      });
      await tx.recommendationItem.createMany({
        data: result.lines.map((l) => ({
          recommendationId: recommendation.id,
          supplierId: l.supplierId,
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          quotationItemId: l.quotationItemId,
        })),
      });
    }

    const requestStatus = optimal ? "AWAITING_APPROVAL" : "NO_FEASIBLE_SOLUTION";
    await transitionRequestTx(tx, {
      requestId,
      businessId,
      to: requestStatus,
      reason: optimal ? "Rekomendasi pembelian siap ditinjau" : "Tidak ada kombinasi pembelian yang valid",
    });

    return { recommendationId: recommendation.id, requestStatus, result };
  });
}
