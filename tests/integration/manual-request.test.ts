import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { getInventoryOverview } from "@/lib/inventory/overview";
import { transitionRequest } from "@/lib/procurement/transition";
import { createManualRequest, evaluateRestock } from "@/lib/procurement/trigger";
import { RUN_DB_TESTS, cleanupBusiness, createTestBusiness, createTestProduct, db, linkSupplier } from "./helpers";

const EXPIRY_HOURS = 24;

describe.skipIf(!RUN_DB_TESTS)("permintaan penawaran manual oleh owner (integrasi DB)", { timeout: 90_000 }, () => {
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

  const manual = (items: { productId: string; quantity: string; maxDeliveryDays?: number }[], clientKey = "kunci-manual-01") =>
    createManualRequest(db(), { businessId, clientKey, items, expiryHours: EXPIRY_HOURS });
  const requestCount = () => db().procurementRequest.count({ where: { businessId } });

  it("barang yang stoknya masih aman tetap bisa diminta, dengan jumlah pilihan owner", async () => {
    const product = await createTestProduct(businessId, { currentStock: "100" }); // jauh di atas reorder point 15
    await linkSupplier(businessId, product.id);
    expect((await evaluateRestock(db(), { businessId, evaluationKey: "cek-otomatis", expiryHours: EXPIRY_HOURS })).outcome).toBe("NOT_NEEDED");

    const outcome = await manual([{ productId: product.id, quantity: "12.5" }]);
    expect(outcome.outcome).toBe("CREATED");

    const request = await db().procurementRequest.findFirstOrThrow({
      where: { businessId },
      include: { items: true, transitions: true },
    });
    expect(request.status).toBe("DRAFT");
    expect(request.triggerSource).toBe("MANUAL");
    expect(request.restockBudget).toBe(1_000_000);
    expect(request.items).toHaveLength(1);
    expect(request.items[0].requiredQuantity.toString()).toBe("12.5"); // snapshot jumlah owner
    expect(request.items[0].maxDeliveryDays).toBe(2); // default = plannedLeadTimeDays
    expect(request.transitions.map((t) => t.reason)).toEqual(["Diminta manual oleh owner"]);
  });

  it("beberapa barang dalam satu request; maxDeliveryDays bisa ditimpa owner", async () => {
    const a = await createTestProduct(businessId, { name: "A", currentStock: "100" });
    const b = await createTestProduct(businessId, { name: "B", currentStock: "100" });
    for (const p of [a, b]) await linkSupplier(businessId, p.id);

    await manual([
      { productId: a.id, quantity: "3" },
      { productId: b.id, quantity: "4", maxDeliveryDays: 7 },
    ]);
    const items = await db().procurementRequestItem.findMany({ where: { businessId }, orderBy: { requiredQuantity: "asc" } });
    expect(items.map((i) => [i.productId, i.maxDeliveryDays])).toEqual([[a.id, 2], [b.id, 7]]);
    expect(await requestCount()).toBe(1);
  });

  it("kunci klien yang sama mengembalikan request yang sama (klik ganda tidak menggandakan)", async () => {
    const product = await createTestProduct(businessId, { currentStock: "100" });
    await linkSupplier(businessId, product.id);
    const first = await manual([{ productId: product.id, quantity: "5" }], "kunci-ganda-01");
    const replay = await manual([{ productId: product.id, quantity: "5" }], "kunci-ganda-01");
    expect(first.outcome).toBe("CREATED");
    expect(replay).toMatchObject({ outcome: "EXISTING", requestId: first.requestId });
    expect(await requestCount()).toBe(1);
  });

  it("ditolak 409 bila ada proses sourcing aktif, tanpa menambah request", async () => {
    const a = await createTestProduct(businessId, { name: "A", currentStock: "100" });
    const b = await createTestProduct(businessId, { name: "B", currentStock: "100" });
    for (const p of [a, b]) await linkSupplier(businessId, p.id);
    await manual([{ productId: a.id, quantity: "5" }], "kunci-pertama-01");

    await expect(manual([{ productId: b.id, quantity: "5" }], "kunci-kedua-0001")).rejects.toMatchObject({
      code: "ACTIVE_SOURCING_EXISTS",
      status: 409,
    });
    expect(await requestCount()).toBe(1);
  });

  it("permintaan paralel dengan kunci berbeda menghasilkan tepat satu request", async () => {
    const product = await createTestProduct(businessId, { currentStock: "100" });
    await linkSupplier(businessId, product.id);
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => manual([{ productId: product.id, quantity: "5" }], `kunci-balapan-${i}`)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await requestCount()).toBe(1);
  });

  it("setelah request dibatalkan, owner boleh meminta lagi", async () => {
    const product = await createTestProduct(businessId, { currentStock: "100" });
    await linkSupplier(businessId, product.id);
    const first = await manual([{ productId: product.id, quantity: "5" }], "kunci-ulang-0001");
    await transitionRequest(db(), { requestId: first.requestId, businessId, to: "CANCELLED" });
    expect((await manual([{ productId: product.id, quantity: "5" }], "kunci-ulang-0002")).outcome).toBe("CREATED");
    expect(await requestCount()).toBe(2);
  });

  it("barang yang masih dalam PO incoming boleh diminta (owner yang memutuskan)", async () => {
    const product = await createTestProduct(businessId, { currentStock: "12" });
    const supplier = await linkSupplier(businessId, product.id);
    const ordered = await db().procurementRequest.create({
      data: { businessId, restockBudget: 1_000_000, status: "ORDERED", aiSettingsVersion: 1, triggerKey: "po-setup-manual" },
    });
    await db().purchaseOrder.create({
      data: {
        poNumber: "PO-ITEST-MANUAL",
        requestId: ordered.id,
        supplierId: supplier.id,
        businessId,
        status: "SENT",
        shippingFee: 0,
        totalCost: 0,
        idempotencyKey: "po-key-manual",
        items: { create: [{ productId: product.id, quantity: "28", unitPrice: 10_000 }] },
      },
    });

    const row = (await getInventoryOverview(db(), businessId)).find((r) => r.id === product.id)!;
    expect(row.incomingQuantity).toBe("28"); // dasar peringatan overbuy di UI

    expect((await manual([{ productId: product.id, quantity: "10" }])).outcome).toBe("CREATED");
  });

  it("budget belum diatur → ditolak", async () => {
    await db().business.update({ where: { id: businessId }, data: { defaultRestockBudget: 0 } });
    const product = await createTestProduct(businessId);
    await linkSupplier(businessId, product.id);
    await expect(manual([{ productId: product.id, quantity: "5" }])).rejects.toMatchObject({ code: "RESTOCK_BUDGET_NOT_SET" });
    expect(await requestCount()).toBe(0);
  });

  it("barang tanpa supplier aktif → ditolak", async () => {
    const product = await createTestProduct(businessId);
    await expect(manual([{ productId: product.id, quantity: "5" }])).rejects.toMatchObject({ code: "NO_ACTIVE_SUPPLIER" });
    expect(await requestCount()).toBe(0);
  });

  it("jumlah nol / melebihi presisi satuan ditolak", async () => {
    const product = await createTestProduct(businessId, { unit: "liter", quantityScale: 0 });
    await linkSupplier(businessId, product.id);
    await expect(manual([{ productId: product.id, quantity: "0" }])).rejects.toMatchObject({ code: "INVALID_QUANTITY" });
    await expect(manual([{ productId: product.id, quantity: "1.5" }])).rejects.toMatchObject({ code: "QUANTITY_SCALE_EXCEEDED" });
    expect(await requestCount()).toBe(0);
  });

  it("lead time kosong → owner wajib mengisi maxDeliveryDays", async () => {
    const product = await createTestProduct(businessId, { plannedLeadTimeDays: null });
    await linkSupplier(businessId, product.id);
    await expect(manual([{ productId: product.id, quantity: "5" }])).rejects.toMatchObject({ code: "MAX_DELIVERY_DAYS_REQUIRED" });
    expect((await manual([{ productId: product.id, quantity: "5", maxDeliveryDays: 3 }])).outcome).toBe("CREATED");
  });

  it("barang ganda dalam satu permintaan ditolak", async () => {
    const product = await createTestProduct(businessId);
    await linkSupplier(businessId, product.id);
    await expect(
      manual([{ productId: product.id, quantity: "1" }, { productId: product.id, quantity: "2" }]),
    ).rejects.toMatchObject({ code: "DUPLICATE_PRODUCT" });
  });

  it("tidak bisa meminta produk milik bisnis lain", async () => {
    const otherId = (await createTestBusiness()).id;
    try {
      const foreign = await createTestProduct(otherId);
      await linkSupplier(otherId, foreign.id);
      await expect(manual([{ productId: foreign.id, quantity: "5" }])).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
      expect(await requestCount()).toBe(0);
    } finally {
      await cleanupBusiness(otherId);
    }
  });

  it("usulan jumlah: requiredQuantity bila perlu restock, selain itu konsumsi × cakupan", async () => {
    const low = await createTestProduct(businessId, { name: "Rendah", currentStock: "12" }); // required 28
    const safe = await createTestProduct(businessId, { name: "Aman", currentStock: "100" }); // 5 × 5 hari = 25
    const rows = await getInventoryOverview(db(), businessId);
    expect(rows.find((r) => r.id === low.id)!.suggestedQuantity).toBe("28");
    expect(rows.find((r) => r.id === safe.id)!.suggestedQuantity).toBe("25");
  });
});
