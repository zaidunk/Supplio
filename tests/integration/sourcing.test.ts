import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ProcurementStatus } from "@/generated/prisma/client";
import { allSessionsFinished, expireOverdueRequests, finishSourcing, getSourcingDeadline, startSourcing } from "@/lib/procurement/sourcing";
import { RUN_DB_TESTS, cleanupBusiness, createConnectedSupplier, createTestBusiness, createTestProduct, db } from "./helpers";
import { FakeTelegram, newChatId } from "./fake-telegram";

describe.skipIf(!RUN_DB_TESTS)("sourcing: outreach → tunggu → optimasi (integrasi DB)", { timeout: 120_000 }, () => {
  let businessId: string;
  let tg: FakeTelegram;

  beforeEach(async () => {
    // Budget sengaja angka khas agar bisa dipastikan tidak bocor ke pesan supplier.
    businessId = (await createTestBusiness({ defaultRestockBudget: 7_654_321 })).id;
    tg = new FakeTelegram();
  });
  afterEach(async () => {
    await cleanupBusiness(businessId);
  });
  afterAll(async () => {
    await db().$disconnect();
  });

  /** Request DRAFT dengan satu/lebih barang (butuh 28, batas kedatangan 2 hari). */
  async function draftRequest(
    products: { id: string }[],
    status: ProcurementStatus = "DRAFT",
    expiresAt?: Date,
    owner: string = businessId,
  ) {
    const request = await db().procurementRequest.create({
      data: {
        businessId: owner,
        restockBudget: 7_654_321,
        status,
        aiSettingsVersion: 1,
        triggerKey: `src-${randomUUID()}`,
        expiresAt: expiresAt ?? new Date(Date.now() + 24 * 3_600_000),
      },
    });
    await db().procurementRequestItem.createMany({
      data: products.map((p) => ({ requestId: request.id, businessId: owner, productId: p.id, requiredQuantity: "28", maxDeliveryDays: 2 })),
    });
    return request;
  }

  const sessionsOf = (requestId: string) => db().negotiationSession.findMany({ where: { requestId }, include: { supplier: true }, orderBy: { createdAt: "asc" } });
  const statusOf = async (id: string) => (await db().procurementRequest.findUniqueOrThrow({ where: { id } })).status;

  it("menghubungi hanya supplier yang boleh: terverifikasi, aktif, menyuplai barang, tidak sibuk", async () => {
    const bawang = await createTestProduct(businessId, { name: "Bawang Putih" });
    const minyak = await createTestProduct(businessId, { name: "Minyak Goreng", unit: "liter" });
    const req = await draftRequest([bawang, minyak]);

    const a = await createConnectedSupplier(businessId, { name: "Supplier A", chatId: newChatId(), productIds: [bawang.id, minyak.id] });
    const b = await createConnectedSupplier(businessId, { name: "Supplier B", chatId: newChatId(), productIds: [bawang.id] });
    await db().supplier.create({ data: { businessId, name: "C belum terhubung" } });
    await createConnectedSupplier(businessId, { name: "D nonaktif", chatId: newChatId(), productIds: [bawang.id], isActive: false });
    await createConnectedSupplier(businessId, { name: "E tak menyuplai", chatId: newChatId(), productIds: [] });
    // Sesi aktif "sisa" di request lain (ORDERED tidak menghitung sebagai sourcing aktif, jadi boleh berdampingan).
    // Satu supplier hanya boleh punya satu sesi aktif, sehingga ia tidak boleh dihubungi untuk request ini.
    const busy = await createConnectedSupplier(businessId, { name: "F sibuk", chatId: newChatId(), productIds: [bawang.id] });
    const otherReq = await draftRequest([bawang], "ORDERED");
    await db().negotiationSession.create({
      data: { requestId: otherReq.id, supplierId: busy.id, businessId, status: "AWAITING_REPLY", aiSettingsVersion: 1 },
    });

    const result = await startSourcing(db(), tg, { requestId: req.id });

    expect(result).toMatchObject({ outcome: "STARTED", contacted: 2 });
    const sessions = await sessionsOf(req.id);
    expect(sessions.map((s) => s.supplier.name)).toEqual(["Supplier A", "Supplier B"]);
    expect(sessions.every((s) => s.status === "AWAITING_REPLY")).toBe(true);
    expect(await statusOf(req.id)).toBe("AWAITING_RESPONSES");

    const history = await db().procurementStatusTransition.findMany({ where: { requestId: req.id }, orderBy: { createdAt: "asc" } });
    // Request dibuat langsung lewat Prisma (tanpa baris awal DRAFT), jadi riwayat hanya memuat dua transisi sourcing.
    expect(history.map((h) => `${h.fromStatus}>${h.toStatus}`)).toEqual(["DRAFT>SOURCING", "SOURCING>AWAITING_RESPONSES"]);

    // A menyuplai dua barang, B hanya bawang: tiap supplier hanya diminta barang yang ia suplai.
    const textA = tg.to(Number(a.telegramChatId))[0].text;
    const textB = tg.to(Number(b.telegramChatId))[0].text;
    expect(textA).toContain("Bawang Putih: 28 kg");
    expect(textA).toContain("Minyak Goreng: 28 liter");
    expect(textB).toContain("Bawang Putih");
    expect(textB).not.toContain("Minyak Goreng");
    expect(tg.sent).toHaveLength(2);
  });

  it("pesan outreach: identitas AI jelas, kebutuhan spesifik, TANPA membocorkan Restock Budget", async () => {
    const p = await createTestProduct(businessId, { name: "Gula" });
    const req = await draftRequest([p]);
    const s = await createConnectedSupplier(businessId, { name: "Supplier A", chatId: newChatId(), productIds: [p.id] });
    await startSourcing(db(), tg, { requestId: req.id });

    const text = tg.to(Number(s.telegramChatId))[0].text;
    expect(text).toMatch(/asisten AI/i);
    expect(text).toMatch(/bukan manusia/i);
    expect(text).toContain("Gula: 28 kg, tiba maksimal 2 hari");
    for (const leak of ["7654321", "7.654.321", "7,654,321", "budget"]) expect(text.toLowerCase()).not.toContain(leak);

    const stored = await db().conversationMessage.findFirstOrThrow({ where: { supplierId: s.id, direction: "OUTBOUND" } });
    expect(stored.sender).toBe("AI");
    expect(stored.sessionId).not.toBeNull();
    expect(stored.telegramMessageId).not.toBeNull();
  });

  it("sesi mendapat batas waktu dari responseTimeoutMinutes (default 20 menit)", async () => {
    const p = await createTestProduct(businessId);
    const req = await draftRequest([p]);
    await createConnectedSupplier(businessId, { name: "A", chatId: newChatId(), productIds: [p.id] });

    const before = Date.now();
    const result = await startSourcing(db(), tg, { requestId: req.id });
    expect(result.outcome).toBe("STARTED");
    const [session] = await sessionsOf(req.id);
    const minutes = (session.expiresAt!.getTime() - before) / 60_000;
    expect(minutes).toBeGreaterThan(19.9);
    expect(minutes).toBeLessThan(20.2);
    expect((await getSourcingDeadline(db(), req.id))?.getTime()).toBe(session.expiresAt!.getTime());
  });

  it("idempoten: menjalankan ulang tidak mengirim ulang pesan dan tidak membuat sesi ganda", async () => {
    const p = await createTestProduct(businessId);
    const req = await draftRequest([p]);
    await createConnectedSupplier(businessId, { name: "A", chatId: newChatId(), productIds: [p.id] });

    await startSourcing(db(), tg, { requestId: req.id });
    const again = await startSourcing(db(), tg, { requestId: req.id });
    const concurrent = await Promise.all([startSourcing(db(), tg, { requestId: req.id }), startSourcing(db(), tg, { requestId: req.id })]);

    expect(again.outcome).toBe("ALREADY_STARTED");
    expect(concurrent.every((r) => r.outcome === "ALREADY_STARTED")).toBe(true);
    expect(tg.sent).toHaveLength(1);
    expect(await sessionsOf(req.id)).toHaveLength(1);
  });

  it("dua startSourcing serentak pada request DRAFT: tetap satu pesan per supplier", async () => {
    const p = await createTestProduct(businessId);
    const req = await draftRequest([p]);
    await createConnectedSupplier(businessId, { name: "A", chatId: newChatId(), productIds: [p.id] });
    await createConnectedSupplier(businessId, { name: "B", chatId: newChatId(), productIds: [p.id] });

    await Promise.allSettled([startSourcing(db(), tg, { requestId: req.id }), startSourcing(db(), tg, { requestId: req.id })]);

    expect(tg.sent).toHaveLength(2); // A dan B masing-masing sekali
    expect(await sessionsOf(req.id)).toHaveLength(2);
    expect(await statusOf(req.id)).toBe("AWAITING_RESPONSES");
  });

  it("galat sementara di tengah jalan → dapat dilanjutkan tanpa mengirim ulang yang sudah terkirim", async () => {
    const p = await createTestProduct(businessId);
    const req = await draftRequest([p]);
    const a = await createConnectedSupplier(businessId, { name: "A", chatId: newChatId(), productIds: [p.id] });
    const b = await createConnectedSupplier(businessId, { name: "B", chatId: newChatId(), productIds: [p.id] });
    tg.failChats.set(Number(b.telegramChatId), 500); // Telegram 5xx untuk B

    await expect(startSourcing(db(), tg, { requestId: req.id })).rejects.toThrow();
    expect(await statusOf(req.id)).toBe("SOURCING"); // setengah jalan
    expect(tg.to(Number(a.telegramChatId))).toHaveLength(1);

    tg.failChats.clear();
    const resumed = await startSourcing(db(), tg, { requestId: req.id });

    expect(resumed).toMatchObject({ outcome: "STARTED", contacted: 2 });
    expect(tg.to(Number(a.telegramChatId))).toHaveLength(1); // A tidak dikirimi ulang
    expect(tg.to(Number(b.telegramChatId))).toHaveLength(1);
    expect(await statusOf(req.id)).toBe("AWAITING_RESPONSES");
  });

  it("tanpa supplier terhubung: request tetap DRAFT (menunggu), tidak ada sesi atau pesan", async () => {
    const p = await createTestProduct(businessId);
    const req = await draftRequest([p]);
    await db().supplier.create({ data: { businessId, name: "Belum onboarding" } });

    expect(await startSourcing(db(), tg, { requestId: req.id })).toEqual({ outcome: "NO_REACHABLE_SUPPLIER" });
    expect(await statusOf(req.id)).toBe("DRAFT");
    expect(await sessionsOf(req.id)).toHaveLength(0);
    expect(tg.sent).toHaveLength(0);

    // Setelah supplier terhubung, request yang menunggu dapat dilanjutkan.
    await createConnectedSupplier(businessId, { name: "Baru terhubung", chatId: newChatId(), productIds: [p.id] });
    expect((await startSourcing(db(), tg, { requestId: req.id })).outcome).toBe("STARTED");
  });

  it("satu supplier memblokir bot: sesinya TIMED_OUT dan koneksinya diputus, supplier lain tetap lanjut", async () => {
    const p = await createTestProduct(businessId);
    const req = await draftRequest([p]);
    const ok = await createConnectedSupplier(businessId, { name: "A baik", chatId: newChatId(), productIds: [p.id] });
    const blocked = await createConnectedSupplier(businessId, { name: "B pemblokir", chatId: newChatId(), productIds: [p.id] });
    tg.failChats.set(Number(blocked.telegramChatId), 403);

    const result = await startSourcing(db(), tg, { requestId: req.id });

    expect(result).toMatchObject({ outcome: "STARTED", contacted: 1 });
    const byName = Object.fromEntries((await sessionsOf(req.id)).map((s) => [s.supplier.name, s.status]));
    expect(byName).toEqual({ "A baik": "AWAITING_REPLY", "B pemblokir": "TIMED_OUT" });
    expect((await db().supplier.findUniqueOrThrow({ where: { id: blocked.id } })).telegramVerifiedAt).toBeNull();
    expect((await db().supplier.findUniqueOrThrow({ where: { id: ok.id } })).telegramVerifiedAt).not.toBeNull();
  });

  it("semua supplier tak terjangkau: request dibatalkan, tidak dibiarkan menggantung", async () => {
    const p = await createTestProduct(businessId);
    const req = await draftRequest([p]);
    const s = await createConnectedSupplier(businessId, { name: "A", chatId: newChatId(), productIds: [p.id] });
    tg.failChats.set(Number(s.telegramChatId), 403);

    expect(await startSourcing(db(), tg, { requestId: req.id })).toEqual({ outcome: "CANCELLED_UNREACHABLE" });
    expect(await statusOf(req.id)).toBe("CANCELLED");
  });

  it("request yang bukan DRAFT/SOURCING dilewati dan request asing ditolak", async () => {
    const p = await createTestProduct(businessId);
    const done = await draftRequest([p], "AWAITING_APPROVAL");
    expect(await startSourcing(db(), tg, { requestId: done.id })).toEqual({ outcome: "ALREADY_STARTED" });
    await expect(startSourcing(db(), tg, { requestId: randomUUID() })).rejects.toMatchObject({ code: "REQUEST_NOT_FOUND" });
  });

  // ── Menunggu & menutup ──────────────────────────────────────────────────────────────────────
  it("allSessionsFinished: false selama ada sesi terbuka, true bila semua final atau tanpa sesi", async () => {
    const p = await createTestProduct(businessId);
    const req = await draftRequest([p]);
    expect(await allSessionsFinished(db(), req.id)).toBe(true); // tanpa sesi
    await createConnectedSupplier(businessId, { name: "A", chatId: newChatId(), productIds: [p.id] });
    await createConnectedSupplier(businessId, { name: "B", chatId: newChatId(), productIds: [p.id] });
    await startSourcing(db(), tg, { requestId: req.id });
    expect(await allSessionsFinished(db(), req.id)).toBe(false);

    const [first, second] = await sessionsOf(req.id);
    await db().negotiationSession.update({ where: { id: first.id }, data: { status: "DECLINED" } });
    expect(await allSessionsFinished(db(), req.id)).toBe(false);
    await db().negotiationSession.update({ where: { id: second.id }, data: { status: "CONFIRMED" } });
    expect(await allSessionsFinished(db(), req.id)).toBe(true);
  });

  it("timeout tanpa penawaran: sesi TIMED_OUT, optimasi dijalankan → NO_FEASIBLE_SOLUTION (tanpa order)", async () => {
    const p = await createTestProduct(businessId);
    const req = await draftRequest([p]);
    await createConnectedSupplier(businessId, { name: "A", chatId: newChatId(), productIds: [p.id] });
    await startSourcing(db(), tg, { requestId: req.id });

    const result = await finishSourcing(db(), { requestId: req.id });

    expect(result).toEqual({ outcome: "OPTIMIZED", requestStatus: "NO_FEASIBLE_SOLUTION" });
    expect((await sessionsOf(req.id)).every((s) => s.status === "TIMED_OUT")).toBe(true);
    const rec = await db().procurementRecommendation.findFirstOrThrow({ where: { requestId: req.id } });
    expect(rec.solverStatus).toBe("NO_FEASIBLE_SOLUTION");
    expect(await db().purchaseOrder.count({ where: { businessId } })).toBe(0);

    expect((await finishSourcing(db(), { requestId: req.id })).outcome).toBe("SKIPPED"); // idempoten
    expect(await db().procurementRecommendation.count({ where: { requestId: req.id } })).toBe(1);
  });

  it("supplier yang tidak membalas dikecualikan; yang sudah memberi penawaran CONFIRMED dioptimasi → AWAITING_APPROVAL", async () => {
    const p = await createTestProduct(businessId, { name: "Bawang Putih" });
    const req = await draftRequest([p]);
    const a = await createConnectedSupplier(businessId, { name: "A menjawab", chatId: newChatId(), productIds: [p.id] });
    await createConnectedSupplier(businessId, { name: "B diam", chatId: newChatId(), productIds: [p.id] });
    await startSourcing(db(), tg, { requestId: req.id });

    const sessionA = (await sessionsOf(req.id)).find((s) => s.supplierId === a.id)!;
    await db().negotiationSession.update({ where: { id: sessionA.id }, data: { status: "CONFIRMED" } });
    await db().quotation.create({
      data: {
        sessionId: sessionA.id,
        supplierId: a.id,
        status: "CONFIRMED",
        shippingFee: 15_000,
        leadTimeDays: 1,
        confirmedAt: new Date(),
        items: { create: [{ productId: p.id, quotedUnitPrice: 39_000, availableQuantity: "100", minimumOrderQuantity: "1" }] },
      },
    });

    const result = await finishSourcing(db(), { requestId: req.id });

    expect(result).toEqual({ outcome: "OPTIMIZED", requestStatus: "AWAITING_APPROVAL" });
    const byName = Object.fromEntries((await sessionsOf(req.id)).map((s) => [s.supplier.name, s.status]));
    expect(byName).toEqual({ "A menjawab": "CONFIRMED", "B diam": "TIMED_OUT" });
    const rec = await db().procurementRecommendation.findFirstOrThrow({ where: { requestId: req.id }, include: { items: true } });
    expect(rec.totalCost).toBe(28 * 39_000 + 15_000);
    expect(rec.items.map((i) => i.supplierId)).toEqual([a.id]);
    expect(await db().purchaseOrder.count({ where: { businessId } })).toBe(0); // belum ada komitmen order
  });

  it("finishSourcing tidak menyentuh request yang sudah dibatalkan atau melewati tahap ini", async () => {
    const p = await createTestProduct(businessId);
    const cancelled = await draftRequest([p], "CANCELLED");
    expect(await finishSourcing(db(), { requestId: cancelled.id })).toEqual({ outcome: "SKIPPED", status: "CANCELLED" });
    expect(await statusOf(cancelled.id)).toBe("CANCELLED");
  });

  // ── Kedaluwarsa ─────────────────────────────────────────────────────────────────────────────
  it("expireOverdueRequests: hanya request sourcing yang lewat batas; sesi ditutup; PO berjalan tak disentuh", async () => {
    // Satu bisnis hanya boleh punya satu sourcing aktif, jadi tiap request aktif memakai bisnis uji sendiri.
    const extra = [await createTestBusiness(), await createTestBusiness()];
    try {
      const past = new Date(Date.now() - 3_600_000);
      const future = new Date(Date.now() + 3_600_000);

      const p = await createTestProduct(businessId);
      const stale = await draftRequest([p], "AWAITING_RESPONSES", past);
      const s = await createConnectedSupplier(businessId, { name: "A", chatId: newChatId(), productIds: [p.id] });
      await db().negotiationSession.create({ data: { requestId: stale.id, supplierId: s.id, businessId, status: "AWAITING_REPLY", aiSettingsVersion: 1 } });
      const ordered = await draftRequest([p], "ORDERED", past); // sudah dipesan: bukan urusan kedaluwarsa

      const p2 = await createTestProduct(extra[0].id);
      const awaitingApproval = await draftRequest([p2], "AWAITING_APPROVAL", past, extra[0].id);
      const p3 = await createTestProduct(extra[1].id);
      const fresh = await draftRequest([p3], "AWAITING_RESPONSES", future, extra[1].id);

      const expired = await expireOverdueRequests(db(), new Date());

      expect(expired).toBeGreaterThanOrEqual(2);
      expect(await statusOf(stale.id)).toBe("EXPIRED");
      expect(await statusOf(awaitingApproval.id)).toBe("EXPIRED");
      expect(await statusOf(ordered.id)).toBe("ORDERED");
      expect(await statusOf(fresh.id)).toBe("AWAITING_RESPONSES");
      expect((await sessionsOf(stale.id))[0].status).toBe("TIMED_OUT");
      expect(await expireOverdueRequests(db(), new Date())).toBe(0); // idempoten
    } finally {
      for (const b of extra) await cleanupBusiness(b.id);
    }
  });
});
