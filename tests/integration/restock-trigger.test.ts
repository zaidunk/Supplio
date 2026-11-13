import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { getIncomingQuantities } from "@/lib/inventory/incoming";
import { applyStockMovement, recordMovement } from "@/lib/inventory/movements";
import { transitionRequest } from "@/lib/procurement/transition";
import { evaluateRestock } from "@/lib/procurement/trigger";
import { RUN_DB_TESTS, cleanupBusiness, createTestBusiness, createTestProduct, db, linkSupplier } from "./helpers";

const EXPIRY_HOURS = 24;
const opts = { expiryHours: EXPIRY_HOURS };

describe.skipIf(!RUN_DB_TESTS)("restock trigger & stok (integrasi DB)", { timeout: 90_000 }, () => {
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

  const requestCount = () => db().procurementRequest.count({ where: { businessId } });

  // ── Acceptance test 1 ───────────────────────────────────────────────────────────────────────
  it("stok berkurang hingga reorderPoint → request dibuat otomatis SEKALI dengan requiredQuantity benar", async () => {
    const product = await createTestProduct(businessId, { currentStock: "20" });
    await linkSupplier(businessId, product.id);

    // 20 - 8 = 12 <= ROP 15 → target 40, required 28
    const first = await recordMovement(db(), { businessId, productId: product.id, type: "OUT", quantity: "8" }, opts);
    expect(first.currentStock).toBe("12");
    expect(first.trigger.outcome).toBe("CREATED");

    const request = await db().procurementRequest.findFirstOrThrow({
      where: { businessId },
      include: { items: true, transitions: true },
    });
    expect(request.status).toBe("DRAFT");
    expect(request.restockBudget).toBe(1_000_000); // snapshot dari defaultRestockBudget
    expect(request.aiSettingsVersion).toBe(1);
    expect(request.items).toHaveLength(1);
    expect(request.items[0].productId).toBe(product.id);
    expect(request.items[0].requiredQuantity.toString()).toBe("28");
    expect(request.items[0].maxDeliveryDays).toBe(2); // default = plannedLeadTimeDays
    expect(request.transitions.map((t) => t.toStatus)).toEqual(["DRAFT"]);
    const hours = (request.expiresAt!.getTime() - request.createdAt.getTime()) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);

    // Mutasi berikutnya saat request masih aktif tidak membuat request kedua.
    const second = await recordMovement(db(), { businessId, productId: product.id, type: "OUT", quantity: "1" }, opts);
    expect(second.trigger.outcome).toBe("NOT_NEEDED");
    expect(await requestCount()).toBe(1);
  });

  it("mengumpulkan SEMUA barang yang memenuhi trigger dalam satu request", async () => {
    const a = await createTestProduct(businessId, { name: "A", currentStock: "12" });
    const b = await createTestProduct(businessId, { name: "B", currentStock: "14" });
    const c = await createTestProduct(businessId, { name: "C", currentStock: "100" }); // aman
    for (const p of [a, b, c]) await linkSupplier(businessId, p.id);

    const outcome = await evaluateRestock(db(), { businessId, evaluationKey: "uji-batch", expiryHours: EXPIRY_HOURS });
    expect(outcome.outcome).toBe("CREATED");
    const items = await db().procurementRequestItem.findMany({ where: { businessId }, orderBy: { requiredQuantity: "desc" } });
    expect(items.map((i) => i.productId).sort()).toEqual([a.id, b.id].sort());
    expect(await requestCount()).toBe(1);
  });

  // ── Idempotensi ─────────────────────────────────────────────────────────────────────────────
  it("mengirim ulang mutasi dengan idempotencyKey sama tidak mengubah stok dan tidak menggandakan request", async () => {
    const product = await createTestProduct(businessId, { currentStock: "20" });
    await linkSupplier(businessId, product.id);
    const input = { businessId, productId: product.id, type: "OUT" as const, quantity: "8", idempotencyKey: "kunci-uji-0001" };

    const first = await recordMovement(db(), input, opts);
    const replay = await recordMovement(db(), input, opts);

    expect(first.duplicate).toBe(false);
    expect(replay.duplicate).toBe(true);
    expect(replay.movementId).toBe(first.movementId);
    expect(replay.currentStock).toBe("12"); // tidak 4
    expect(replay.trigger).toMatchObject({ outcome: "EXISTING" });
    expect(await requestCount()).toBe(1);
    expect(await db().inventoryMovement.count({ where: { productId: product.id } })).toBe(1);
  });

  it("kunci idempotensi yang sama pada bisnis berbeda tidak saling menimpa", async () => {
    const otherId = (await createTestBusiness()).id;
    try {
      const p1 = await createTestProduct(businessId, { currentStock: "20" });
      const p2 = await createTestProduct(otherId, { currentStock: "20" });
      const key = "kunci-bersama-01";
      const r1 = await applyStockMovement(db(), { businessId, productId: p1.id, type: "OUT", quantity: "1", idempotencyKey: key });
      const r2 = await applyStockMovement(db(), { businessId: otherId, productId: p2.id, type: "OUT", quantity: "1", idempotencyKey: key });
      expect(r1.duplicate).toBe(false);
      expect(r2.duplicate).toBe(false);
    } finally {
      await cleanupBusiness(otherId);
    }
  });

  it("evaluasi paralel yang berlomba menghasilkan tepat satu request (index unik parsial)", async () => {
    const product = await createTestProduct(businessId, { currentStock: "12" });
    await linkSupplier(businessId, product.id);

    const outcomes = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        evaluateRestock(db(), { businessId, evaluationKey: `balapan-${i}`, expiryHours: EXPIRY_HOURS }),
      ),
    );
    expect(outcomes.filter((o) => o.outcome === "CREATED")).toHaveLength(1);
    expect(await requestCount()).toBe(1);
  });

  it("evaluasi dengan kunci peristiwa yang sama mengembalikan request yang sama", async () => {
    const product = await createTestProduct(businessId, { currentStock: "12" });
    await linkSupplier(businessId, product.id);
    const a = await evaluateRestock(db(), { businessId, evaluationKey: "peristiwa-1", expiryHours: EXPIRY_HOURS });
    const b = await evaluateRestock(db(), { businessId, evaluationKey: "peristiwa-1", expiryHours: EXPIRY_HOURS });
    expect(a.outcome).toBe("CREATED");
    expect(b).toMatchObject({ outcome: "EXISTING", requestId: (a as { requestId: string }).requestId });
  });

  // ── Acceptance test 2 ───────────────────────────────────────────────────────────────────────
  describe("incomingQuantity dari PO outstanding", () => {
    /** Request ORDERED + PO outstanding berisi `qty` untuk produk. */
    async function orderedPo(productId: string, supplierId: string, qty: string) {
      const request = await db().procurementRequest.create({
        data: { businessId, restockBudget: 1_000_000, status: "ORDERED", aiSettingsVersion: 1, triggerKey: `po-setup-${productId}` },
      });
      return db().purchaseOrder.create({
        data: {
          poNumber: `PO-ITEST-${productId.slice(0, 8)}`,
          requestId: request.id,
          supplierId,
          businessId,
          status: "SENT",
          shippingFee: 0,
          totalCost: 0,
          idempotencyKey: `po-key-${productId}`,
          items: { create: [{ productId, quantity: qty, unitPrice: 10_000 }] },
        },
      });
    }

    it("PO outstanding mencegah trigger ganda", async () => {
      const product = await createTestProduct(businessId, { currentStock: "12" });
      const supplier = await linkSupplier(businessId, product.id);
      await orderedPo(product.id, supplier.id, "28"); // 12 + 28 = 40 = target

      const incoming = await getIncomingQuantities(db(), businessId);
      expect(incoming.get(product.id)?.toString()).toBe("28");

      const outcome = await evaluateRestock(db(), { businessId, evaluationKey: "setelah-po", expiryHours: EXPIRY_HOURS });
      expect(outcome.outcome).toBe("NOT_NEEDED");
      expect(await db().procurementRequest.count({ where: { businessId, status: "DRAFT" } })).toBe(0);
    });

    it("penerimaan sebagian mengurangi outstanding sesuai jumlah yang diterima", async () => {
      const product = await createTestProduct(businessId, { currentStock: "12" });
      const supplier = await linkSupplier(businessId, product.id);
      const po = await orderedPo(product.id, supplier.id, "28");

      await db().goodsReceipt.create({
        data: { purchaseOrderId: po.id, idempotencyKey: `rcpt-${po.id}`, items: { create: [{ productId: product.id, receivedQuantity: "10" }] } },
      });
      await db().purchaseOrder.update({ where: { id: po.id }, data: { status: "PARTIALLY_RECEIVED" } });

      const incoming = await getIncomingQuantities(db(), businessId);
      expect(incoming.get(product.id)?.toString()).toBe("18"); // 28 - 10
    });

    it("PO yang sudah RECEIVED / CANCELLED tidak dihitung sebagai incoming", async () => {
      const product = await createTestProduct(businessId, { currentStock: "12" });
      const supplier = await linkSupplier(businessId, product.id);
      const po = await orderedPo(product.id, supplier.id, "28");
      await db().purchaseOrder.update({ where: { id: po.id }, data: { status: "RECEIVED" } });
      expect((await getIncomingQuantities(db(), businessId)).size).toBe(0);
    });

    it("request ORDERED tidak memblokir sourcing baru untuk barang lain", async () => {
      const covered = await createTestProduct(businessId, { name: "Sudah dipesan", currentStock: "12" });
      const supplier = await linkSupplier(businessId, covered.id);
      await orderedPo(covered.id, supplier.id, "28");

      const other = await createTestProduct(businessId, { name: "Barang lain", currentStock: "5" });
      await linkSupplier(businessId, other.id);

      const outcome = await evaluateRestock(db(), { businessId, evaluationKey: "barang-lain", expiryHours: EXPIRY_HOURS });
      expect(outcome.outcome).toBe("CREATED");
      expect((outcome as { productIds: string[] }).productIds).toEqual([other.id]);
    });
  });

  // ── Satu sourcing aktif per bisnis ──────────────────────────────────────────────────────────
  it("kebutuhan baru saat sourcing aktif berjalan ditandai DEFERRED, tidak ditambahkan diam-diam", async () => {
    const a = await createTestProduct(businessId, { name: "A", currentStock: "12" });
    await linkSupplier(businessId, a.id);
    expect((await evaluateRestock(db(), { businessId, evaluationKey: "e1", expiryHours: EXPIRY_HOURS })).outcome).toBe("CREATED");

    const b = await createTestProduct(businessId, { name: "B", currentStock: "5" });
    await linkSupplier(businessId, b.id);
    const outcome = await evaluateRestock(db(), { businessId, evaluationKey: "e2", expiryHours: EXPIRY_HOURS });

    expect(outcome).toMatchObject({ outcome: "DEFERRED", pendingProductIds: [b.id] });
    const items = await db().procurementRequestItem.findMany({ where: { businessId } });
    expect(items.map((i) => i.productId)).toEqual([a.id]); // B tidak masuk request berjalan
  });

  it("setelah request dibatalkan, evaluasi berikutnya boleh membuat request baru", async () => {
    const product = await createTestProduct(businessId, { currentStock: "12" });
    await linkSupplier(businessId, product.id);
    const first = await evaluateRestock(db(), { businessId, evaluationKey: "ulang-1", expiryHours: EXPIRY_HOURS });
    await transitionRequest(db(), { requestId: (first as { requestId: string }).requestId, businessId, to: "CANCELLED" });
    const second = await evaluateRestock(db(), { businessId, evaluationKey: "ulang-2", expiryHours: EXPIRY_HOURS });
    expect(second.outcome).toBe("CREATED");
    expect(await requestCount()).toBe(2);
  });

  // ── CONFIGURATION_REQUIRED ──────────────────────────────────────────────────────────────────
  it("budget belum diatur → CONFIGURATION_REQUIRED dan tidak ada request", async () => {
    await db().business.update({ where: { id: businessId }, data: { defaultRestockBudget: 0 } });
    const product = await createTestProduct(businessId, { currentStock: "12" });
    await linkSupplier(businessId, product.id);

    const outcome = await evaluateRestock(db(), { businessId, evaluationKey: "tanpa-budget", expiryHours: EXPIRY_HOURS });
    expect(outcome.outcome).toBe("CONFIGURATION_REQUIRED");
    expect((outcome as { issues: { code: string }[] }).issues.map((i) => i.code)).toContain("RESTOCK_BUDGET_NOT_SET");
    expect(await requestCount()).toBe(0);
  });

  it("konfigurasi perencanaan belum lengkap dilaporkan per produk", async () => {
    const product = await createTestProduct(businessId, { currentStock: "1", dailyConsumption: null });
    await linkSupplier(businessId, product.id);
    const outcome = await evaluateRestock(db(), { businessId, evaluationKey: "tanpa-konsumsi", expiryHours: EXPIRY_HOURS });
    expect(outcome).toMatchObject({
      outcome: "CONFIGURATION_REQUIRED",
      issues: [{ code: "PLANNING_CONFIG_MISSING", productId: product.id, missing: ["dailyConsumption"] }],
    });
    expect(await requestCount()).toBe(0);
  });

  it("barang tanpa supplier aktif dilaporkan dan tidak masuk request", async () => {
    const product = await createTestProduct(businessId, { currentStock: "1" });
    const outcome = await evaluateRestock(db(), { businessId, evaluationKey: "tanpa-supplier", expiryHours: EXPIRY_HOURS });
    expect(outcome).toMatchObject({ outcome: "CONFIGURATION_REQUIRED", issues: [{ code: "NO_ACTIVE_SUPPLIER", productId: product.id }] });
    expect(await requestCount()).toBe(0);
  });

  // ── Integritas stok ─────────────────────────────────────────────────────────────────────────
  it("OUT melebihi stok ditolak dan stok tidak berubah", async () => {
    const product = await createTestProduct(businessId, { currentStock: "5" });
    await expect(
      applyStockMovement(db(), { businessId, productId: product.id, type: "OUT", quantity: "5.1" }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    const after = await db().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.currentStock.toString()).toBe("5");
    expect(await db().inventoryMovement.count({ where: { productId: product.id } })).toBe(0); // movement ikut rollback
  });

  it("dua OUT paralel tidak membuat stok negatif", async () => {
    const product = await createTestProduct(businessId, { currentStock: "12" });
    const results = await Promise.allSettled([
      applyStockMovement(db(), { businessId, productId: product.id, type: "OUT", quantity: "8" }),
      applyStockMovement(db(), { businessId, productId: product.id, type: "OUT", quantity: "8" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const after = await db().product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.currentStock.toString()).toBe("4");
  });

  it("ADJUSTMENT bertanda menambah/mengurangi stok", async () => {
    const product = await createTestProduct(businessId, { currentStock: "10" });
    expect((await applyStockMovement(db(), { businessId, productId: product.id, type: "ADJUSTMENT", quantity: "-3" })).currentStock).toBe("7");
    expect((await applyStockMovement(db(), { businessId, productId: product.id, type: "ADJUSTMENT", quantity: "2.5" })).currentStock).toBe("9.5");
  });

  it("kuantitas melebihi presisi satuan ditolak", async () => {
    const product = await createTestProduct(businessId, { unit: "liter", quantityScale: 0, currentStock: "10" });
    await expect(
      applyStockMovement(db(), { businessId, productId: product.id, type: "IN", quantity: "1.5" }),
    ).rejects.toMatchObject({ code: "QUANTITY_SCALE_EXCEEDED" });
  });

  it("tidak bisa memutasi produk milik bisnis lain", async () => {
    const otherId = (await createTestBusiness()).id;
    try {
      const foreign = await createTestProduct(otherId, { currentStock: "10" });
      await expect(
        applyStockMovement(db(), { businessId, productId: foreign.id, type: "OUT", quantity: "1" }),
      ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
    } finally {
      await cleanupBusiness(otherId);
    }
  });

  // ── Transisi status ─────────────────────────────────────────────────────────────────────────
  describe("transisi status", () => {
    async function draftRequest() {
      const product = await createTestProduct(businessId, { currentStock: "12" });
      await linkSupplier(businessId, product.id);
      const out = await evaluateRestock(db(), { businessId, evaluationKey: `trans-${product.id}`, expiryHours: EXPIRY_HOURS });
      return (out as { requestId: string }).requestId;
    }

    it("mencatat riwayat transisi yang sah", async () => {
      const requestId = await draftRequest();
      await transitionRequest(db(), { requestId, businessId, to: "SOURCING", reason: "outreach dimulai" });
      const history = await db().procurementStatusTransition.findMany({ where: { requestId }, orderBy: { createdAt: "asc" } });
      expect(history.map((h) => `${h.fromStatus}>${h.toStatus}`)).toEqual(["null>DRAFT", "DRAFT>SOURCING"]);
    });

    it("menolak transisi mundur/terlarang dan event duplikat menjadi no-op", async () => {
      const requestId = await draftRequest();
      await transitionRequest(db(), { requestId, businessId, to: "SOURCING" });
      await expect(transitionRequest(db(), { requestId, businessId, to: "DRAFT" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
      await expect(transitionRequest(db(), { requestId, businessId, to: "ORDERED" })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });

      const dup = await transitionRequest(db(), { requestId, businessId, to: "SOURCING" });
      expect(dup.changed).toBe(false);
      expect(await db().procurementStatusTransition.count({ where: { requestId } })).toBe(2);
    });

    it("tidak bisa memindah status request milik bisnis lain", async () => {
      const requestId = await draftRequest();
      const otherId = (await createTestBusiness()).id;
      try {
        await expect(transitionRequest(db(), { requestId, businessId: otherId, to: "SOURCING" })).rejects.toMatchObject({
          code: "REQUEST_NOT_FOUND",
        });
      } finally {
        await cleanupBusiness(otherId);
      }
    });
  });
});
