import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { getIncomingQuantities } from "@/lib/inventory/incoming";
import { approveRecommendation, rejectRequest } from "@/lib/procurement/approval";
import { runOptimization } from "@/lib/procurement/optimize";
import { sendOrderConfirmations } from "@/lib/procurement/orders";
import { listPurchaseOrders, recordGoodsReceipt } from "@/lib/procurement/receiving";
import { FakeTelegram, newChatId } from "./fake-telegram";
import { RUN_DB_TESTS, cleanupBusiness, createConnectedSupplier, createTestBusiness, createTestProduct, db } from "./helpers";

const BUDGET = 7_654_321;

describe.skipIf(!RUN_DB_TESTS)("Final Approval, PO, konfirmasi order, penerimaan barang (integrasi DB)", { timeout: 120_000 }, () => {
  let businessId: string;
  let requestId: string;
  let gula: { id: string };
  let minyak: { id: string };
  let supA: { id: string; chatId: number };
  let supB: { id: string; chatId: number };
  let tg: FakeTelegram;

  beforeEach(async () => {
    businessId = (await createTestBusiness({ defaultRestockBudget: BUDGET })).id;
    gula = await createTestProduct(businessId, { name: "Gula Pasir", quantityScale: 1, currentStock: "5" });
    minyak = await createTestProduct(businessId, { name: "Minyak Goreng", unit: "liter", quantityScale: 0, currentStock: "3" });

    requestId = (
      await db().procurementRequest.create({
        data: { businessId, restockBudget: BUDGET, status: "OPTIMIZING", aiSettingsVersion: 1, triggerKey: `ord-${randomUUID()}` },
      })
    ).id;
    await db().procurementRequestItem.createMany({
      data: [
        { requestId, businessId, productId: gula.id, requiredQuantity: "28", maxDeliveryDays: 2 },
        { requestId, businessId, productId: minyak.id, requiredQuantity: "20", maxDeliveryDays: 2 },
      ],
    });

    // A: gula 16.500 + minyak 18.000, ongkir 25.000. B: hanya minyak 17.200, ongkir 15.000.
    // Optimal = A(gula) + B(minyak) = 846.000 (A saja 847.000): dua supplier, dua PO.
    supA = await connected("Supplier A", [gula.id, minyak.id]);
    supB = await connected("Supplier B", [minyak.id]);
    await quote(supA.id, 25_000, 1, [
      { productId: gula.id, price: 16_500, moq: "10" },
      { productId: minyak.id, price: 18_000, moq: "1" },
    ]);
    await quote(supB.id, 15_000, 2, [{ productId: minyak.id, price: 17_200, moq: "1" }]);
    tg = new FakeTelegram();
  });
  afterEach(async () => {
    await cleanupBusiness(businessId);
  });
  afterAll(async () => {
    await db().$disconnect();
  });

  async function connected(name: string, productIds: string[]) {
    const chatId = newChatId();
    const s = await createConnectedSupplier(businessId, { name, chatId, productIds });
    return { id: s.id, chatId };
  }

  async function quote(supplierId: string, shippingFee: number, leadTimeDays: number, items: { productId: string; price: number; moq: string }[]) {
    const session = await db().negotiationSession.create({
      data: { requestId, supplierId, businessId, status: "CONFIRMED", aiSettingsVersion: 1 },
    });
    return db().quotation.create({
      data: {
        sessionId: session.id,
        supplierId,
        status: "CONFIRMED",
        shippingFee,
        leadTimeDays,
        confirmedAt: new Date(),
        items: { create: items.map((i) => ({ productId: i.productId, quotedUnitPrice: i.price, availableQuantity: "200", minimumOrderQuantity: i.moq })) },
      },
    });
  }

  /** Jalankan optimizer sungguhan → request AWAITING_APPROVAL dengan rekomendasi nyata. */
  async function recommend() {
    const run = await runOptimization(db(), { businessId, requestId });
    expect(run.requestStatus).toBe("AWAITING_APPROVAL");
    return run.recommendationId;
  }

  const requestRow = () => db().procurementRequest.findUniqueOrThrow({ where: { id: requestId } });
  const orders = () => db().purchaseOrder.findMany({ where: { businessId }, include: { items: true }, orderBy: { totalCost: "desc" } });
  const stock = async (productId: string) => (await db().product.findUniqueOrThrow({ where: { id: productId } })).currentStock.toString();

  // ════════════════════ Final Approval ════════════════════
  describe("Final Approval (acceptance test 10)", () => {
    it("tanpa Final Approval tidak ada PO dan tidak ada pesan order ke supplier", async () => {
      await recommend();
      expect(await orders()).toHaveLength(0);
      expect(tg.sent).toHaveLength(0);
      const sent = await sendOrderConfirmations(db(), tg, { businessId, requestId });
      expect(sent).toEqual({ sent: 0, failed: [] });
      expect(tg.sent).toHaveLength(0);
      expect((await requestRow()).status).toBe("AWAITING_APPROVAL");
    });

    it("approve membuat satu PO per supplier terpilih dengan total persis sama dengan rekomendasi; stok TIDAK berubah", async () => {
      const recommendationId = await recommend();
      const rec = await db().procurementRecommendation.findUniqueOrThrow({ where: { id: recommendationId } });
      expect(rec.totalCost).toBe(846_000);

      const result = await approveRecommendation(db(), { businessId, requestId, recommendationId, idempotencyKey: "klik-pertama-0001" });

      expect(result.outcome).toBe("APPROVED");
      if (result.outcome !== "APPROVED") return;
      expect(result.orders).toHaveLength(2);
      expect(result.orders.reduce((s, o) => s + o.totalCost, 0)).toBe(rec.totalCost);
      for (const o of result.orders) expect(o.poNumber).toMatch(/^PO-\d{8}-[0-9A-F]{6}$/);

      const pos = await orders();
      expect(pos.map((p) => [p.supplierId === supA.id ? "A" : "B", p.totalCost, p.shippingFee, p.status])).toEqual([
        ["A", 487_000, 25_000, "CREATED"], // 28 × 16.500 + 25.000
        ["B", 359_000, 15_000, "CREATED"], // 20 × 17.200 + 15.000
      ]);
      const a = pos.find((p) => p.supplierId === supA.id)!;
      expect(a.items.map((i) => [i.productId === gula.id ? "gula" : "minyak", i.quantity.toString(), i.unitPrice])).toEqual([["gula", "28", 16_500]]);

      const request = await requestRow();
      expect(request.status).toBe("ORDERED");
      expect(request.approvedByOwnerAt).not.toBeNull();
      expect(request.approvalKey).toBe(`${businessId}:klik-pertama-0001`);
      const history = await db().procurementStatusTransition.findMany({ where: { requestId }, orderBy: { createdAt: "asc" } });
      expect(history.map((h) => `${h.fromStatus}>${h.toStatus}`)).toEqual(expect.arrayContaining(["AWAITING_APPROVAL>APPROVED", "APPROVED>ORDERED"]));

      // Membuat PO tidak menambah currentStock (hanya GoodsReceipt yang menambah).
      expect(await stock(gula.id)).toBe("5");
      expect(await stock(minyak.id)).toBe("3");
      // Approval sendiri tidak mengirim apa pun; konfirmasi order adalah langkah terpisah setelah PO sah.
      expect(tg.sent).toHaveLength(0);
    });

    it("double approval (berurutan) tidak menggandakan PO", async () => {
      const recommendationId = await recommend();
      const first = await approveRecommendation(db(), { businessId, requestId, recommendationId, idempotencyKey: "kunci-ganda-0001" });
      const second = await approveRecommendation(db(), { businessId, requestId, recommendationId, idempotencyKey: "kunci-ganda-0001" });
      const third = await approveRecommendation(db(), { businessId, requestId }); // tanpa kunci: tetap dianggap permintaan yang sama

      expect(first.outcome).toBe("APPROVED");
      expect(second.outcome).toBe("DUPLICATE");
      expect(third.outcome).toBe("DUPLICATE");
      expect(await orders()).toHaveLength(2);
      expect(second.outcome === "DUPLICATE" && second.orders.map((o) => o.poNumber).sort()).toEqual(
        first.outcome === "APPROVED" ? first.orders.map((o) => o.poNumber).sort() : null,
      );
    });

    it("lima klik bersamaan: tepat satu yang membuat PO, yang lain DUPLICATE; hanya dua PO di database", async () => {
      const recommendationId = await recommend();
      const results = await Promise.all(
        Array.from({ length: 5 }, () => approveRecommendation(db(), { businessId, requestId, recommendationId, idempotencyKey: "klik-serentak-01" })),
      );
      expect(results.filter((r) => r.outcome === "APPROVED")).toHaveLength(1);
      expect(results.filter((r) => r.outcome === "DUPLICATE")).toHaveLength(4);
      expect(await orders()).toHaveLength(2);
      expect(await db().procurementStatusTransition.count({ where: { requestId, toStatus: "ORDERED" } })).toBe(1);
    });

    it("persetujuan dengan kunci BERBEDA setelah disetujui ditolak, tanpa PO tambahan", async () => {
      const recommendationId = await recommend();
      await approveRecommendation(db(), { businessId, requestId, recommendationId, idempotencyKey: "kunci-pertama-01" });
      await expect(
        approveRecommendation(db(), { businessId, requestId, recommendationId, idempotencyKey: "kunci-lain-000002" }),
      ).rejects.toMatchObject({ code: "ALREADY_APPROVED", status: 409 });
      expect(await orders()).toHaveLength(2);
    });

    it("rekomendasi usang, status salah, request kedaluwarsa, dan bisnis lain ditolak tanpa PO", async () => {
      const recommendationId = await recommend();
      await expect(approveRecommendation(db(), { businessId, requestId, recommendationId: randomUUID() })).rejects.toMatchObject({ code: "STALE_RECOMMENDATION" });

      const other = await createTestBusiness();
      try {
        await expect(approveRecommendation(db(), { businessId: other.id, requestId, recommendationId })).rejects.toMatchObject({ code: "REQUEST_NOT_FOUND" });
      } finally {
        await cleanupBusiness(other.id);
      }

      await db().procurementRequest.update({ where: { id: requestId }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await expect(approveRecommendation(db(), { businessId, requestId, recommendationId })).rejects.toMatchObject({ code: "REQUEST_EXPIRED" });

      await db().procurementRequest.update({ where: { id: requestId }, data: { status: "NO_FEASIBLE_SOLUTION", expiresAt: null } });
      await expect(approveRecommendation(db(), { businessId, requestId, recommendationId })).rejects.toMatchObject({ code: "REQUEST_NOT_AWAITING_APPROVAL" });
      expect(await orders()).toHaveLength(0);
    });

    it("rekomendasi NO_FEASIBLE_SOLUTION tidak bisa disetujui", async () => {
      await db().procurementRequest.update({ where: { id: requestId }, data: { status: "AWAITING_APPROVAL" } });
      await db().procurementRecommendation.create({
        data: { requestId, totalCost: 0, remainingBudget: BUDGET, solverStatus: "NO_FEASIBLE_SOLUTION", explanation: "tidak ada solusi" },
      });
      await expect(approveRecommendation(db(), { businessId, requestId })).rejects.toMatchObject({ code: "NO_RECOMMENDATION" });
      expect(await orders()).toHaveLength(0);
    });
  });

  // ════════════════════ Validasi ulang saat approval (§4.3) ════════════════════
  describe("validasi ulang: bila data berubah, JANGAN memesan", () => {
    const expectNotOrdered = async () => {
      expect(await orders()).toHaveLength(0);
      expect((await requestRow()).approvedByOwnerAt).toBeNull();
      expect((await requestRow()).approvalKey).toBeNull();
    };

    it("penawaran kedaluwarsa → ditolak, kembali ke optimasi dan dihitung ulang", async () => {
      const recommendationId = await recommend();
      await db().quotation.updateMany({ where: { supplierId: supA.id }, data: { validUntil: new Date(Date.now() - 60_000) } });

      const result = await approveRecommendation(db(), { businessId, requestId, recommendationId });

      expect(result.outcome).toBe("REVALIDATION_FAILED");
      if (result.outcome !== "REVALIDATION_FAILED") return;
      expect(result.violations.map((v) => v.code)).toContain("QUOTATION_EXPIRED");
      expect(result.rerun).toBe("NO_FEASIBLE_SOLUTION"); // gula hanya dijual A, dan A kedaluwarsa
      await expectNotOrdered();
      const history = await db().procurementStatusTransition.findMany({ where: { requestId }, orderBy: { createdAt: "asc" } });
      expect(history.some((h) => h.toStatus === "OPTIMIZING" && /Validasi ulang/.test(h.reason ?? ""))).toBe(true);
      expect((await requestRow()).status).toBe("NO_FEASIBLE_SOLUTION");
    });

    it("harga penawaran berubah → ditolak; rekomendasi baru memakai harga baru dan bisa disetujui", async () => {
      const recommendationId = await recommend();
      await db().quotationItem.updateMany({ where: { productId: gula.id }, data: { quotedUnitPrice: 16_900 } });

      const result = await approveRecommendation(db(), { businessId, requestId, recommendationId });

      expect(result.outcome).toBe("REVALIDATION_FAILED");
      if (result.outcome !== "REVALIDATION_FAILED") return;
      expect(result.violations.map((v) => v.code)).toEqual(expect.arrayContaining(["PRICE_CHANGED", "TOTAL_MISMATCH"]));
      expect(result.rerun).toBe("AWAITING_APPROVAL");
      await expectNotOrdered();

      const fresh = await db().procurementRecommendation.findFirstOrThrow({ where: { requestId }, orderBy: { createdAt: "desc" } });
      expect(fresh.id).not.toBe(recommendationId);
      expect(fresh.totalCost).toBe(28 * 16_900 + 25_000 + 20 * 17_200 + 15_000); // 856.200

      // Rekomendasi lama sudah usang; yang baru bisa disetujui.
      await expect(approveRecommendation(db(), { businessId, requestId, recommendationId })).rejects.toMatchObject({ code: "STALE_RECOMMENDATION" });
      expect((await approveRecommendation(db(), { businessId, requestId, recommendationId: fresh.id })).outcome).toBe("APPROVED");
    });

    it("budget request lebih kecil dari total → ditolak (budget ditegakkan ulang)", async () => {
      const recommendationId = await recommend();
      await db().procurementRequest.update({ where: { id: requestId }, data: { restockBudget: 800_000 } });
      const result = await approveRecommendation(db(), { businessId, requestId, recommendationId });
      expect(result.outcome === "REVALIDATION_FAILED" && result.violations.map((v) => v.code)).toContain("BUDGET_EXCEEDED");
      await expectNotOrdered();
    });

    it("harga maksimum produk diturunkan di bawah harga penawaran → ditolak", async () => {
      const recommendationId = await recommend();
      await db().product.update({ where: { id: gula.id }, data: { maximumUnitPrice: 16_000 } });
      const result = await approveRecommendation(db(), { businessId, requestId, recommendationId });
      expect(result.outcome === "REVALIDATION_FAILED" && result.violations.map((v) => v.code)).toContain("PRICE_ABOVE_MAXIMUM");
      await expectNotOrdered();
    });

    it("supplier dinonaktifkan setelah rekomendasi → ditolak", async () => {
      const recommendationId = await recommend();
      await db().supplier.update({ where: { id: supA.id }, data: { isActive: false } });
      const result = await approveRecommendation(db(), { businessId, requestId, recommendationId });
      expect(result.outcome).toBe("REVALIDATION_FAILED");
      await expectNotOrdered();
    });

    it("penawaran yang lebih baru dari supplier yang sama menggantikan rekomendasi → ditolak", async () => {
      const recommendationId = await recommend();
      // Satu sesi per (request, supplier): supplier A mengirim penawaran BARU pada sesi yang sama (lebih murah).
      const session = await db().negotiationSession.findFirstOrThrow({ where: { requestId, supplierId: supA.id } });
      await db().quotation.create({
        data: {
          sessionId: session.id,
          supplierId: supA.id,
          status: "CONFIRMED",
          shippingFee: 25_000,
          leadTimeDays: 1,
          confirmedAt: new Date(Date.now() + 1000),
          items: { create: [{ productId: gula.id, quotedUnitPrice: 16_000, availableQuantity: "200", minimumOrderQuantity: "10" }] },
        },
      });
      const result = await approveRecommendation(db(), { businessId, requestId, recommendationId });
      expect(result.outcome).toBe("REVALIDATION_FAILED");
      await expectNotOrdered();
    });
  });

  // ════════════════════ Reject ════════════════════
  describe("Reject / Cancel", () => {
    it("menolak rekomendasi: request CANCELLED, tanpa PO, sesi ditutup, idempoten", async () => {
      await recommend();
      const r1 = await rejectRequest(db(), { businessId, requestId, reason: "Harga kemahalan" });
      const r2 = await rejectRequest(db(), { businessId, requestId });
      expect(r1.alreadyCancelled).toBe(false);
      expect(r2.alreadyCancelled).toBe(true);
      expect((await requestRow()).status).toBe("CANCELLED");
      expect(await orders()).toHaveLength(0);
      const t = await db().procurementStatusTransition.findFirstOrThrow({ where: { requestId, toStatus: "CANCELLED" } });
      expect(t.reason).toContain("Harga kemahalan");
    });

    it("membatalkan saat menunggu balasan menutup sesi yang masih berjalan", async () => {
      await db().procurementRequest.update({ where: { id: requestId }, data: { status: "AWAITING_RESPONSES" } });
      await db().negotiationSession.updateMany({ where: { requestId, supplierId: supA.id }, data: { status: "AWAITING_REPLY" } });
      await rejectRequest(db(), { businessId, requestId });
      const s = await db().negotiationSession.findFirstOrThrow({ where: { requestId, supplierId: supA.id } });
      expect(s.status).toBe("TIMED_OUT");
    });

    it("request yang sudah dipesan tidak bisa dibatalkan lewat Reject", async () => {
      const recommendationId = await recommend();
      await approveRecommendation(db(), { businessId, requestId, recommendationId });
      await expect(rejectRequest(db(), { businessId, requestId })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
      expect((await requestRow()).status).toBe("ORDERED");
      expect(await orders()).toHaveLength(2);
    });

    it("tidak bisa membatalkan request milik bisnis lain", async () => {
      await recommend();
      const other = await createTestBusiness();
      try {
        await expect(rejectRequest(db(), { businessId: other.id, requestId })).rejects.toMatchObject({ code: "REQUEST_NOT_FOUND" });
      } finally {
        await cleanupBusiness(other.id);
      }
      expect((await requestRow()).status).toBe("AWAITING_APPROVAL");
    });
  });

  // ════════════════════ Konfirmasi order ke Telegram ════════════════════
  describe("konfirmasi order (hanya setelah PO sah)", () => {
    async function approve() {
      const recommendationId = await recommend();
      return approveRecommendation(db(), { businessId, requestId, recommendationId });
    }

    it("mengirim nomor PO, item, dan total ke tiap supplier; PO menjadi SENT; tanpa membocorkan budget", async () => {
      await approve();
      const result = await sendOrderConfirmations(db(), tg, { businessId, requestId });

      expect(result).toEqual({ sent: 2, failed: [] });
      const pos = await orders();
      expect(pos.every((p) => p.status === "SENT" && p.sentAt !== null)).toBe(true);

      const toA = tg.to(supA.chatId)[0].text;
      const poA = pos.find((p) => p.supplierId === supA.id)!;
      expect(toA).toContain(`PESANAN RESMI ${poA.poNumber}`);
      expect(toA).toMatch(/asisten AI Supplio atas persetujuan pemilik/);
      expect(toA).toContain("Gula Pasir: 28 kg");
      expect(toA).toMatch(/Total: Rp\s?487\.000/);
      expect(toA).toContain("Estimasi tiba: 1 hari");
      expect(toA).not.toContain("Minyak"); // PO A hanya berisi gula
      for (const m of tg.sent) for (const leak of ["7654321", "7.654.321", "846.000"]) expect(m.text).not.toContain(leak);

      const toB = tg.to(supB.chatId)[0].text;
      expect(toB).toContain("Minyak Goreng: 20 liter");
      expect(toB).toContain("Estimasi tiba: 2 hari");
    });

    it("idempoten: dipanggil ulang atau serentak tidak mengirim pesan kedua", async () => {
      await approve();
      await Promise.all([sendOrderConfirmations(db(), tg, { businessId, requestId }), sendOrderConfirmations(db(), tg, { businessId, requestId })]);
      const again = await sendOrderConfirmations(db(), tg, { businessId, requestId });
      expect(again.sent).toBe(0);
      expect(tg.to(supA.chatId)).toHaveLength(1);
      expect(tg.to(supB.chatId)).toHaveLength(1);
    });

    it("supplier tidak terhubung: PO tetap sah (CREATED), yang lain tetap terkirim, dan bisa dikirim ulang", async () => {
      await approve();
      await db().supplier.update({ where: { id: supB.id }, data: { telegramVerifiedAt: null } });

      const first = await sendOrderConfirmations(db(), tg, { businessId, requestId });
      expect(first.sent).toBe(1);
      expect(first.failed).toHaveLength(1);
      const poB = (await orders()).find((p) => p.supplierId === supB.id)!;
      expect(poB.status).toBe("CREATED");
      expect(first.failed[0].poNumber).toBe(poB.poNumber);

      await db().supplier.update({ where: { id: supB.id }, data: { telegramVerifiedAt: new Date() } });
      const retry = await sendOrderConfirmations(db(), tg, { businessId, purchaseOrderId: poB.id });
      expect(retry.sent).toBe(1);
      expect(tg.to(supA.chatId)).toHaveLength(1); // A tidak dikirimi ulang
      expect((await db().purchaseOrder.findUniqueOrThrow({ where: { id: poB.id } })).status).toBe("SENT");
    });

    it("bot diblokir supplier: PO tetap CREATED dan koneksi diputus, tanpa galat yang membatalkan PO", async () => {
      await approve();
      tg.failChats.set(supB.chatId, 403);
      const result = await sendOrderConfirmations(db(), tg, { businessId, requestId });
      expect(result.sent).toBe(1);
      expect(result.failed).toHaveLength(1);
      expect((await orders()).filter((p) => p.status === "CREATED")).toHaveLength(1);
      expect((await db().supplier.findUniqueOrThrow({ where: { id: supB.id } })).telegramVerifiedAt).toBeNull();
    });

    it("tidak mengirim PO milik bisnis lain", async () => {
      await approve();
      const other = await createTestBusiness();
      try {
        expect(await sendOrderConfirmations(db(), tg, { businessId: other.id, requestId })).toEqual({ sent: 0, failed: [] });
        expect(tg.sent).toHaveLength(0);
      } finally {
        await cleanupBusiness(other.id);
      }
    });
  });

  // ════════════════════ Penerimaan barang ════════════════════
  describe("penerimaan barang (acceptance test 11)", () => {
    async function ordered() {
      const recommendationId = await recommend();
      await approveRecommendation(db(), { businessId, requestId, recommendationId });
      const pos = await orders();
      return { poA: pos.find((p) => p.supplierId === supA.id)!, poB: pos.find((p) => p.supplierId === supB.id)! };
    }
    const receive = (purchaseOrderId: string, items: { productId: string; receivedQuantity: string }[], key: string = randomUUID()) =>
      recordGoodsReceipt(db(), { businessId, purchaseOrderId, items, idempotencyKey: key });

    it("penerimaan sebagian menambah stok SEBESAR YANG DITERIMA dan mengurangi outstanding", async () => {
      const { poA } = await ordered();

      const r1 = await receive(poA.id, [{ productId: gula.id, receivedQuantity: "10" }]);

      expect(r1).toMatchObject({ duplicate: false, purchaseOrderStatus: "PARTIALLY_RECEIVED", requestStatus: "PARTIALLY_RECEIVED" });
      expect(await stock(gula.id)).toBe("15"); // 5 + 10, bukan 5 + 28
      const mv = await db().inventoryMovement.findFirstOrThrow({ where: { referenceId: r1.receiptId } });
      expect(mv).toMatchObject({ type: "IN", productId: gula.id });
      expect(mv.quantity.toString()).toBe("10");
      expect((await db().product.findUniqueOrThrow({ where: { id: gula.id } })).lastPurchaseUnitPrice).toBe(16_500);

      // incomingQuantity = sisa pesanan: posisi stok tidak berubah sehingga tidak memicu restock ganda.
      const incoming = await getIncomingQuantities(db(), businessId);
      expect(incoming.get(gula.id)?.toString()).toBe("18");
      expect(incoming.get(minyak.id)?.toString()).toBe("20");
    });

    it("penerimaan lengkap per PO; request COMPLETED hanya setelah SEMUA PO diterima penuh", async () => {
      const { poA, poB } = await ordered();
      await receive(poA.id, [{ productId: gula.id, receivedQuantity: "10" }]);
      const rest = await receive(poA.id, [{ productId: gula.id, receivedQuantity: "18" }]);
      expect(rest).toMatchObject({ purchaseOrderStatus: "RECEIVED", requestStatus: "PARTIALLY_RECEIVED" }); // PO B belum
      expect(await stock(gula.id)).toBe("33");

      const last = await receive(poB.id, [{ productId: minyak.id, receivedQuantity: "20" }]);
      expect(last).toMatchObject({ purchaseOrderStatus: "RECEIVED", requestStatus: "COMPLETED" });
      expect(await stock(minyak.id)).toBe("23");
      expect((await requestRow()).status).toBe("COMPLETED");
      expect((await getIncomingQuantities(db(), businessId)).size).toBe(0);
    });

    it("sekali terima penuh langsung menyelesaikan PO", async () => {
      const { poB } = await ordered();
      expect(await receive(poB.id, [{ productId: minyak.id, receivedQuantity: "20" }])).toMatchObject({ purchaseOrderStatus: "RECEIVED", requestStatus: "PARTIALLY_RECEIVED" });
    });

    it("melebihi outstanding ditolak (tanpa efek), termasuk setelah penerimaan sebagian", async () => {
      const { poA } = await ordered();
      await expect(receive(poA.id, [{ productId: gula.id, receivedQuantity: "28.1" }])).rejects.toMatchObject({ code: "RECEIPT_EXCEEDS_OUTSTANDING", status: 409 });
      expect(await stock(gula.id)).toBe("5");

      await receive(poA.id, [{ productId: gula.id, receivedQuantity: "20" }]);
      await expect(receive(poA.id, [{ productId: gula.id, receivedQuantity: "8.1" }])).rejects.toMatchObject({ code: "RECEIPT_EXCEEDS_OUTSTANDING" });
      expect(await stock(gula.id)).toBe("25");
      expect(await db().goodsReceipt.count({ where: { purchaseOrderId: poA.id } })).toBe(1);
    });

    it("kunci idempotensi yang sama menambah stok sekali (berurutan dan serentak)", async () => {
      const { poA } = await ordered();
      const items = [{ productId: gula.id, receivedQuantity: "10" }];
      const first = await receive(poA.id, items, "terima-sama-0001");
      const replay = await receive(poA.id, items, "terima-sama-0001");
      expect(replay).toMatchObject({ duplicate: true, receiptId: first.receiptId });
      expect(await stock(gula.id)).toBe("15");

      const burst = await Promise.allSettled(Array.from({ length: 5 }, () => receive(poA.id, [{ productId: gula.id, receivedQuantity: "3" }], "terima-serentak-01")));
      expect(burst.every((r) => r.status === "fulfilled")).toBe(true);
      expect(await stock(gula.id)).toBe("18"); // 15 + 3, hanya sekali
      expect(await db().goodsReceipt.count({ where: { purchaseOrderId: poA.id } })).toBe(2);
    });

    it("dua penerimaan penuh serentak dengan kunci berbeda: totalnya tidak pernah melebihi pesanan", async () => {
      const { poA } = await ordered();
      const results = await Promise.allSettled([
        receive(poA.id, [{ productId: gula.id, receivedQuantity: "28" }], "kunci-serentak-aa"),
        receive(poA.id, [{ productId: gula.id, receivedQuantity: "28" }], "kunci-serentak-bb"),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await stock(gula.id)).toBe("33");
    });

    it("kunci idempotensi tidak boleh dipakai ulang untuk PO lain", async () => {
      const { poA, poB } = await ordered();
      await receive(poA.id, [{ productId: gula.id, receivedQuantity: "1" }], "kunci-dipakai-ulang");
      await expect(receive(poB.id, [{ productId: minyak.id, receivedQuantity: "1" }], "kunci-dipakai-ulang")).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
      expect(await stock(minyak.id)).toBe("3");
    });

    it.each([
      ["kosong", [], "EMPTY_RECEIPT"],
      ["nol", [{ receivedQuantity: "0" }], "INVALID_QUANTITY"],
      ["negatif", [{ receivedQuantity: "-1" }], "INVALID_QUANTITY"],
      ["bukan angka", [{ receivedQuantity: "banyak" }], "INVALID_QUANTITY"],
      ["lebih dari presisi satuan (gula 1 desimal)", [{ receivedQuantity: "2.55" }], "QUANTITY_SCALE_EXCEEDED"],
    ] as [string, { receivedQuantity: string }[], string][])("menolak penerimaan %s", async (_n, items, code) => {
      const { poA } = await ordered();
      await expect(receive(poA.id, items.map((i) => ({ productId: gula.id, ...i })))).rejects.toMatchObject({ code });
      expect(await stock(gula.id)).toBe("5");
    });

    it("menolak barang di luar PO, barang ganda, dan PO bisnis lain", async () => {
      const { poA } = await ordered();
      await expect(receive(poA.id, [{ productId: minyak.id, receivedQuantity: "1" }])).rejects.toMatchObject({ code: "PRODUCT_NOT_IN_PO" });
      await expect(
        receive(poA.id, [{ productId: gula.id, receivedQuantity: "1" }, { productId: gula.id, receivedQuantity: "1" }]),
      ).rejects.toMatchObject({ code: "DUPLICATE_PRODUCT" });

      const other = await createTestBusiness();
      try {
        await expect(
          recordGoodsReceipt(db(), { businessId: other.id, purchaseOrderId: poA.id, items: [{ productId: gula.id, receivedQuantity: "1" }], idempotencyKey: randomUUID() }),
        ).rejects.toMatchObject({ code: "PO_NOT_FOUND" });
      } finally {
        await cleanupBusiness(other.id);
      }
      expect(await stock(gula.id)).toBe("5");
    });

    it("PO yang sudah diterima penuh atau dibatalkan tidak menerima barang lagi", async () => {
      const { poA, poB } = await ordered();
      await receive(poA.id, [{ productId: gula.id, receivedQuantity: "28" }]);
      await expect(receive(poA.id, [{ productId: gula.id, receivedQuantity: "1" }])).rejects.toMatchObject({ code: "PO_NOT_RECEIVABLE" });
      await db().purchaseOrder.update({ where: { id: poB.id }, data: { status: "CANCELLED" } });
      await expect(receive(poB.id, [{ productId: minyak.id, receivedQuantity: "1" }])).rejects.toMatchObject({ code: "PO_NOT_RECEIVABLE" });
    });

    it("daftar PO memuat dipesan/diterima/outstanding dan riwayat penerimaan", async () => {
      const { poA } = await ordered();
      await receive(poA.id, [{ productId: gula.id, receivedQuantity: "10" }]);
      const [row] = await listPurchaseOrders(db(), businessId, { id: poA.id });
      expect(row.items).toEqual([expect.objectContaining({ productName: "Gula Pasir", ordered: "28", received: "10", outstanding: "18" })]);
      expect(row.receipts).toHaveLength(1);
      expect(row.status).toBe("PARTIALLY_RECEIVED");
      expect((await listPurchaseOrders(db(), businessId, { outstandingOnly: true })).map((p) => p.id)).toContain(poA.id);
    });
  });
});
