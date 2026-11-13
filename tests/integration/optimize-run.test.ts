import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { QuotationStatus } from "@/generated/prisma/client";
import { runOptimization } from "@/lib/procurement/optimize";
import { RUN_DB_TESTS, cleanupBusiness, createTestBusiness, createTestProduct, db } from "./helpers";

describe.skipIf(!RUN_DB_TESTS)("runOptimization (integrasi DB)", { timeout: 90_000 }, () => {
  let businessId: string;

  beforeEach(async () => {
    businessId = (await createTestBusiness()).id;
  });
  afterEach(async () => {
    await cleanupBusiness(businessId);
  });
  afterAll(async () => {
    await db().$disconnect();
  });

  /** Request OPTIMIZING berisi satu produk (butuh 28, batas kedatangan 2 hari). */
  async function optimizingRequest(opts: { budget?: number; maximumUnitPrice?: number } = {}) {
    const product = await createTestProduct(businessId, { name: "Bawang Putih", quantityScale: 1 });
    if (opts.maximumUnitPrice) await db().product.update({ where: { id: product.id }, data: { maximumUnitPrice: opts.maximumUnitPrice } });
    const request = await db().procurementRequest.create({
      data: {
        businessId,
        restockBudget: opts.budget ?? 5_000_000,
        status: "OPTIMIZING",
        aiSettingsVersion: 1,
        triggerKey: `opt-${randomUUID()}`,
      },
    });
    await db().procurementRequestItem.create({
      data: { requestId: request.id, businessId, productId: product.id, requiredQuantity: "28", maxDeliveryDays: 2 },
    });
    return { request, product };
  }

  /** Supplier + sesi + penawaran untuk request. */
  async function addQuotation(
    requestId: string,
    productId: string,
    o: {
      supplier: string;
      price: number;
      shippingFee?: number;
      leadTimeDays?: number;
      available?: string;
      moq?: string;
      status?: QuotationStatus;
      confirmedAt?: Date | null;
      isActive?: boolean;
    },
  ) {
    const supplier =
      (await db().supplier.findFirst({ where: { businessId, name: o.supplier } })) ??
      (await db().supplier.create({ data: { businessId, name: o.supplier, isActive: o.isActive ?? true } }));
    const session =
      (await db().negotiationSession.findFirst({ where: { requestId, supplierId: supplier.id } })) ??
      (await db().negotiationSession.create({
        data: { requestId, supplierId: supplier.id, businessId, status: "CONFIRMED", aiSettingsVersion: 1 },
      }));
    return db().quotation.create({
      data: {
        sessionId: session.id,
        supplierId: supplier.id,
        status: o.status ?? "CONFIRMED",
        shippingFee: o.shippingFee ?? 0,
        leadTimeDays: o.leadTimeDays ?? 1,
        confirmedAt: o.confirmedAt === undefined ? new Date() : o.confirmedAt,
        items: {
          create: [
            { productId, quotedUnitPrice: o.price, availableQuantity: o.available ?? "100", minimumOrderQuantity: o.moq ?? "1" },
          ],
        },
      },
      include: { items: true },
    });
  }

  const statusOf = async (id: string) => (await db().procurementRequest.findUniqueOrThrow({ where: { id } })).status;

  it("memilih penawaran valid termurah, menyimpan rekomendasi, dan pindah ke AWAITING_APPROVAL", async () => {
    const { request, product } = await optimizingRequest();
    await addQuotation(request.id, product.id, { supplier: "A", price: 37_000, leadTimeDays: 5 }); // terlalu lama
    await addQuotation(request.id, product.id, { supplier: "B", price: 39_000, shippingFee: 15_000 });
    const c = await addQuotation(request.id, product.id, { supplier: "C", price: 40_000, shippingFee: 0 });

    const run = await runOptimization(db(), { businessId, requestId: request.id });
    expect(run.requestStatus).toBe("AWAITING_APPROVAL");
    expect(run.result.status).toBe("OPTIMAL");

    // B: 28 × 39.000 + 15.000 = 1.107.000 ; C: 28 × 40.000 = 1.120.000 → B menang.
    const rec = await db().procurementRecommendation.findUniqueOrThrow({
      where: { id: run.recommendationId },
      include: { items: true, suppliers: true },
    });
    expect(rec.solverStatus).toBe("OPTIMAL");
    expect(rec.totalCost).toBe(1_107_000);
    expect(rec.remainingBudget).toBe(5_000_000 - 1_107_000);
    expect(rec.items).toHaveLength(1);
    expect(rec.items[0]).toMatchObject({ unitPrice: 39_000 });
    expect(rec.items[0].quantity.toString()).toBe("28");
    expect(rec.items[0].quotationItemId).not.toBe(c.items[0].id);
    expect(rec.suppliers).toHaveLength(1);
    expect(rec.suppliers[0].shippingFee).toBe(15_000);
    expect(rec.explanation).toContain("Sisa Restock Budget");

    expect(await statusOf(request.id)).toBe("AWAITING_APPROVAL");
    const history = await db().procurementStatusTransition.findMany({ where: { requestId: request.id }, orderBy: { createdAt: "asc" } });
    expect(history.at(-1)).toMatchObject({ fromStatus: "OPTIMIZING", toStatus: "AWAITING_APPROVAL" });
    // Belum ada komitmen order.
    expect(await db().purchaseOrder.count({ where: { businessId } })).toBe(0);
  });

  it("memakai penawaran CONFIRMED terbaru per supplier, bukan yang lama", async () => {
    const { request, product } = await optimizingRequest();
    const old = new Date(Date.now() - 3_600_000);
    await addQuotation(request.id, product.id, { supplier: "A", price: 30_000, confirmedAt: old }); // lama (lebih murah)
    await addQuotation(request.id, product.id, { supplier: "A", price: 38_000, confirmedAt: new Date() }); // terbaru

    const run = await runOptimization(db(), { businessId, requestId: request.id });
    expect(run.result.status).toBe("OPTIMAL");
    const item = await db().recommendationItem.findFirstOrThrow({ where: { recommendationId: run.recommendationId } });
    expect(item.unitPrice).toBe(38_000);
  });

  it("mengabaikan penawaran yang belum CONFIRMED dan supplier nonaktif", async () => {
    const { request, product } = await optimizingRequest();
    await addQuotation(request.id, product.id, { supplier: "Draft", price: 1_000, status: "NEEDS_CLARIFICATION" });
    await addQuotation(request.id, product.id, { supplier: "Nonaktif", price: 2_000, isActive: false });
    await addQuotation(request.id, product.id, { supplier: "Sah", price: 39_000 });

    const run = await runOptimization(db(), { businessId, requestId: request.id });
    const item = await db().recommendationItem.findFirstOrThrow({ where: { recommendationId: run.recommendationId }, include: { supplier: true } });
    expect(item.supplier.name).toBe("Sah");
  });

  it("menegakkan harga maksimum produk dari data produk, bukan dari penawaran", async () => {
    const { request, product } = await optimizingRequest({ maximumUnitPrice: 38_000 });
    await addQuotation(request.id, product.id, { supplier: "Mahal", price: 39_000 });
    const run = await runOptimization(db(), { businessId, requestId: request.id });
    expect(run.requestStatus).toBe("NO_FEASIBLE_SOLUTION");
  });

  it("tidak feasible → NO_FEASIBLE_SOLUTION, rekomendasi tanpa item, tanpa order", async () => {
    const { request, product } = await optimizingRequest({ budget: 1_000_000 }); // minimum 1.092.000 + ongkir
    await addQuotation(request.id, product.id, { supplier: "B", price: 39_000, shippingFee: 15_000 });

    const run = await runOptimization(db(), { businessId, requestId: request.id });
    expect(run.requestStatus).toBe("NO_FEASIBLE_SOLUTION");
    expect(run.result.status).toBe("NO_FEASIBLE_SOLUTION");

    const rec = await db().procurementRecommendation.findUniqueOrThrow({
      where: { id: run.recommendationId },
      include: { items: true, suppliers: true },
    });
    expect(rec.solverStatus).toBe("NO_FEASIBLE_SOLUTION");
    expect(rec.totalCost).toBe(0);
    expect(rec.remainingBudget).toBe(1_000_000); // budget tidak disentuh
    expect(rec.items).toHaveLength(0);
    expect(rec.explanation).toContain("keputusan manual");
    expect(rec.explanation).toContain("Restock Budget");
    expect(await statusOf(request.id)).toBe("NO_FEASIBLE_SOLUTION");
    expect(await db().purchaseOrder.count({ where: { businessId } })).toBe(0);
  });

  it("tanpa penawaran sama sekali → NO_FEASIBLE_SOLUTION (supplier tak membalas tidak dianggap menawar harga referensi)", async () => {
    const { request } = await optimizingRequest();
    const run = await runOptimization(db(), { businessId, requestId: request.id });
    expect(run.requestStatus).toBe("NO_FEASIBLE_SOLUTION");
  });

  it("hanya untuk status OPTIMIZING; eksekusi ulang ditolak dan tidak menggandakan rekomendasi", async () => {
    const { request, product } = await optimizingRequest();
    await addQuotation(request.id, product.id, { supplier: "B", price: 39_000 });
    await runOptimization(db(), { businessId, requestId: request.id });
    await expect(runOptimization(db(), { businessId, requestId: request.id })).rejects.toMatchObject({
      code: "REQUEST_NOT_OPTIMIZING",
      status: 409,
    });
    expect(await db().procurementRecommendation.count({ where: { requestId: request.id } })).toBe(1);
    expect(await statusOf(request.id)).toBe("AWAITING_APPROVAL"); // tidak mundur
  });

  it("dua eksekusi bersamaan menghasilkan tepat satu rekomendasi", async () => {
    const { request, product } = await optimizingRequest();
    await addQuotation(request.id, product.id, { supplier: "B", price: 39_000 });
    const results = await Promise.allSettled([
      runOptimization(db(), { businessId, requestId: request.id }),
      runOptimization(db(), { businessId, requestId: request.id }),
      runOptimization(db(), { businessId, requestId: request.id }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db().procurementRecommendation.count({ where: { requestId: request.id } })).toBe(1);
  });

  it("request dari bisnis lain tidak bisa dioptimasi", async () => {
    const { request } = await optimizingRequest();
    const otherId = (await createTestBusiness()).id;
    try {
      await expect(runOptimization(db(), { businessId: otherId, requestId: request.id })).rejects.toMatchObject({ code: "REQUEST_NOT_FOUND" });
    } finally {
      await cleanupBusiness(otherId);
    }
  });
});
