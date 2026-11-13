import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLinkToken, hashToken } from "@/lib/telegram/onboarding";
import { processTelegramUpdate } from "@/lib/telegram/process-update";
import { sendOutbound } from "@/lib/telegram/outbound";
import { RUN_DB_TESTS, cleanupBusiness, createConnectedSupplier, createTestBusiness, db } from "./helpers";
import { FakeTelegram, callbackUpdate, cleanupUpdates, ingest, newChatId, textUpdate } from "./fake-telegram";

describe.skipIf(!RUN_DB_TESTS)("onboarding Telegram supplier (integrasi DB)", { timeout: 90_000 }, () => {
  let businessId: string;
  let tg: FakeTelegram;

  beforeEach(async () => {
    businessId = (await createTestBusiness()).id;
    tg = new FakeTelegram();
  });
  afterEach(async () => {
    await cleanupUpdates(db());
    await cleanupBusiness(businessId);
  });
  afterAll(async () => {
    await db().$disconnect();
  });

  const newSupplier = (name = "Supplier A") => db().supplier.create({ data: { businessId, name } });
  const link = async (supplierId: string, now?: Date, ttlHours = 48) => {
    const { url, expiresAt } = await createLinkToken(db(), { businessId, supplierId, botUsername: "SupplioBot", ttlHours, now });
    return { url, expiresAt, token: new URL(url).searchParams.get("start")! };
  };
  const connect = async (token: string, chatId: number) => {
    await ingest(db(), tg, textUpdate({ chatId, text: `/start ${token}` }));
    const button = tg.to(chatId).at(-1)?.inlineKeyboard?.[0]?.[0];
    return ingest(db(), tg, callbackUpdate({ chatId, data: button!.callback_data }));
  };

  it("membuat tautan t.me sekali pakai; hanya HASH token yang disimpan; masa berlaku sesuai TTL", async () => {
    const supplier = await newSupplier();
    const { url, expiresAt, token } = await link(supplier.id, new Date(), 48);

    expect(url).toBe(`https://t.me/SupplioBot?start=${token}`);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = await db().telegramLinkToken.findMany({ where: { supplierId: supplier.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0].usedAt).toBeNull();
    expect(Math.round((expiresAt.getTime() - Date.now()) / 3_600_000)).toBe(48);
  });

  it("tautan baru membatalkan tautan lama yang belum dipakai; supplier bisnis lain ditolak", async () => {
    const supplier = await newSupplier();
    const first = await link(supplier.id);
    const second = await link(supplier.id);
    expect(first.token).not.toBe(second.token);
    expect(await db().telegramLinkToken.count({ where: { supplierId: supplier.id } })).toBe(1);

    const other = await createTestBusiness();
    try {
      await expect(
        createLinkToken(db(), { businessId: other.id, supplierId: supplier.id, botUsername: "SupplioBot", ttlHours: 1 }),
      ).rejects.toMatchObject({ code: "SUPPLIER_NOT_FOUND" });
    } finally {
      await cleanupBusiness(other.id);
    }
  });

  it("/start <token> hanya meminta persetujuan (bot belum menyimpan koneksi)", async () => {
    const supplier = await newSupplier("Toko Maju");
    const chatId = newChatId();
    const { token } = await link(supplier.id);

    await ingest(db(), tg, textUpdate({ chatId, text: `/start ${token}` }));

    const [msg] = tg.to(chatId);
    expect(msg.text).toMatch(/asisten AI/i);
    expect(msg.text).toMatch(/bukan manusia/i);
    expect(msg.text).toContain("Toko Maju");
    expect(msg.inlineKeyboard?.[0][0].callback_data).toMatch(/^link:[0-9a-f-]{36}$/);

    const after = await db().supplier.findUniqueOrThrow({ where: { id: supplier.id } });
    expect(after.telegramChatId).toBeNull();
    expect(after.telegramVerifiedAt).toBeNull();
    expect((await db().telegramLinkToken.findFirstOrThrow({ where: { supplierId: supplier.id } })).usedAt).toBeNull();
  });

  it("menekan tombol persetujuan menyimpan chatId, userId, verifiedAt dan menghanguskan token", async () => {
    const supplier = await newSupplier();
    const chatId = newChatId();
    const { token } = await link(supplier.id);

    const result = await connect(token, chatId);

    const after = await db().supplier.findUniqueOrThrow({ where: { id: supplier.id } });
    expect(after.telegramChatId).toBe(BigInt(chatId));
    expect(after.telegramUserId).toBe(BigInt(chatId));
    expect(after.telegramVerifiedAt).not.toBeNull();
    expect((await db().telegramLinkToken.findFirstOrThrow({ where: { supplierId: supplier.id } })).usedAt).not.toBeNull();
    expect(result.events).toEqual([{ name: "supplier/telegram.connected", data: { supplierId: supplier.id, businessId } }]);
    expect(tg.answers.at(-1)?.text).toMatch(/terhubung/i);
    expect(tg.to(chatId).at(-1)?.text).toMatch(/koneksi berhasil/i);
  });

  it("memproses ulang update yang sama (retry) tidak mengirim balasan ganda", async () => {
    const supplier = await newSupplier();
    const chatId = newChatId();
    const { token } = await link(supplier.id);
    await ingest(db(), tg, textUpdate({ chatId, text: `/start ${token}` }));
    const cb = callbackUpdate({ chatId, data: tg.to(chatId).at(-1)!.inlineKeyboard![0][0].callback_data });
    await db().telegramUpdate.create({ data: { updateId: BigInt(cb.update_id), payload: cb as object } });

    await processTelegramUpdate(db(), tg, cb.update_id); // retry Inngest / redispatch / after()
    const sentAfterFirst = tg.sent.length;
    const retry = await processTelegramUpdate(db(), tg, cb.update_id);

    expect(tg.sent.length).toBe(sentAfterFirst); // tidak ada pesan baru
    expect(retry.events).toEqual([]); // sudah terhubung: tidak memicu event lagi
    expect(await db().conversationMessage.count({ where: { supplierId: supplier.id, direction: "OUTBOUND" } })).toBe(2); // konsen + terhubung
    await db().telegramUpdate.delete({ where: { updateId: BigInt(cb.update_id) } });
  });

  it("tautan kedaluwarsa ditolak (saat /start maupun saat tombol ditekan)", async () => {
    const supplier = await newSupplier();
    const chatId = newChatId();
    const { token } = await link(supplier.id, new Date(Date.now() - 3 * 24 * 3_600_000), 1); // sudah lewat

    await ingest(db(), tg, textUpdate({ chatId, text: `/start ${token}` }));
    expect(tg.to(chatId)[0].text).toMatch(/tidak valid|kedaluwarsa/i);
    expect(tg.to(chatId)[0].inlineKeyboard).toBeUndefined();

    const tokenRow = await db().telegramLinkToken.findFirstOrThrow({ where: { supplierId: supplier.id } });
    const result = await ingest(db(), tg, callbackUpdate({ chatId, data: `link:${tokenRow.id}` }));
    expect(result.events).toEqual([]);
    expect((await db().supplier.findUniqueOrThrow({ where: { id: supplier.id } })).telegramChatId).toBeNull();
  });

  it("token sekali pakai: chat kedua tidak bisa memakai tautan yang sudah dipakai", async () => {
    const supplier = await newSupplier();
    const first = newChatId();
    const second = newChatId();
    const { token } = await link(supplier.id);
    await connect(token, first);
    const tokenRow = await db().telegramLinkToken.findFirstOrThrow({ where: { supplierId: supplier.id } });

    await ingest(db(), tg, textUpdate({ chatId: second, text: `/start ${token}` }));
    expect(tg.to(second)[0].text).toMatch(/tidak valid|sudah dipakai/i);

    const forged = await ingest(db(), tg, callbackUpdate({ chatId: second, data: `link:${tokenRow.id}` }));
    expect(forged.events).toEqual([]);
    expect((await db().supplier.findUniqueOrThrow({ where: { id: supplier.id } })).telegramChatId).toBe(BigInt(first)); // tidak berpindah
  });

  it("dua penekanan serentak dari chat berbeda → hanya satu yang berhasil menghubungkan", async () => {
    const supplier = await newSupplier();
    const a = newChatId();
    const b = newChatId();
    const { token } = await link(supplier.id);
    await ingest(db(), tg, textUpdate({ chatId: a, text: `/start ${token}` }));
    await ingest(db(), tg, textUpdate({ chatId: b, text: `/start ${token}` }));
    const tokenRow = await db().telegramLinkToken.findFirstOrThrow({ where: { supplierId: supplier.id } });

    const results = await Promise.all([
      ingest(db(), tg, callbackUpdate({ chatId: a, data: `link:${tokenRow.id}` })),
      ingest(db(), tg, callbackUpdate({ chatId: b, data: `link:${tokenRow.id}` })),
    ]);
    expect(results.flatMap((r) => r.events)).toHaveLength(1);
    const bound = (await db().supplier.findUniqueOrThrow({ where: { id: supplier.id } })).telegramChatId;
    expect([BigInt(a), BigInt(b)]).toContain(bound);
  });

  it("satu chat tidak bisa terhubung ke dua supplier", async () => {
    const chatId = newChatId();
    await createConnectedSupplier(businessId, { name: "Sudah terhubung", chatId });
    const other = await newSupplier("Supplier B");
    const { token } = await link(other.id);

    const result = await connect(token, chatId);
    expect(result.events).toEqual([]);
    expect((await db().supplier.findUniqueOrThrow({ where: { id: other.id } })).telegramChatId).toBeNull();
    expect((await db().telegramLinkToken.findFirstOrThrow({ where: { supplierId: other.id } })).usedAt).toBeNull(); // rollback utuh
    expect(tg.answers.at(-1)?.text).toMatch(/sudah terhubung ke supplier lain/i);
  });

  it("/start tanpa payload → sambutan; payload sembarang → ditolak; grup diabaikan", async () => {
    const chatId = newChatId();
    await ingest(db(), tg, textUpdate({ chatId, text: "/start" }));
    expect(tg.to(chatId)[0].text).toMatch(/asisten AI Supplio/);

    await ingest(db(), tg, textUpdate({ chatId, text: "/start tebak-tebakan-token-ngawur-0001" }));
    expect(tg.to(chatId)[1].text).toMatch(/tidak valid/i);

    const group = newChatId();
    await ingest(db(), tg, textUpdate({ chatId: group, text: "/start apapun", chatType: "supergroup" }));
    expect(tg.to(group)).toHaveLength(0);
  });

  it("bot diblokir supplier → koneksi diputus dan galat jelas", async () => {
    const chatId = newChatId();
    const supplier = await createConnectedSupplier(businessId, { name: "Pemblokir", chatId });
    tg.failChats.set(chatId, 403);

    await expect(
      sendOutbound(db(), tg, { supplierId: supplier.id, chatId, text: "halo", idempotencyKey: `uji-blokir-${supplier.id}` }),
    ).rejects.toMatchObject({ code: "SUPPLIER_UNREACHABLE" });
    expect((await db().supplier.findUniqueOrThrow({ where: { id: supplier.id } })).telegramVerifiedAt).toBeNull();
  });

  it("pemanggil serentak dengan kunci sama: Telegram menerima TEPAT SATU pesan", async () => {
    const chatId = newChatId();
    const supplier = await createConnectedSupplier(businessId, { name: "S", chatId });
    const input = { supplierId: supplier.id, chatId, text: "satu kali", idempotencyKey: `uji-idem-${supplier.id}` };

    const results = await Promise.all(Array.from({ length: 8 }, () => sendOutbound(db(), tg, input)));
    const again = await sendOutbound(db(), tg, input);

    expect(tg.to(chatId)).toHaveLength(1);
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1); // hanya satu pemilik yang mengirim
    expect(again.duplicate).toBe(true);
    expect(await db().conversationMessage.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
    expect(new Set([...results, again].map((r) => r.messageId)).size).toBe(1);
  });

  it("pengiriman yang gagal melepaskan klaim: retry langsung mengirim sekali, tanpa sisa catatan", async () => {
    const chatId = newChatId();
    const supplier = await createConnectedSupplier(businessId, { name: "S", chatId });
    const input = { supplierId: supplier.id, chatId, text: "coba lagi", idempotencyKey: `uji-retry-${supplier.id}` };

    tg.failChats.set(chatId, 500);
    await expect(sendOutbound(db(), tg, input)).rejects.toThrow();
    expect(await db().conversationMessage.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(0);

    tg.failChats.delete(chatId);
    const retry = await sendOutbound(db(), tg, input);
    expect(retry.duplicate).toBe(false);
    expect(tg.to(chatId)).toHaveLength(1);
  });

  it("catatan menunggu yang usang (pengirim sebelumnya mati) dikirim ulang; yang baru dianggap sedang dikirim", async () => {
    const chatId = newChatId();
    const supplier = await createConnectedSupplier(businessId, { name: "S", chatId });
    const key = `uji-usang-${supplier.id}`;
    const row = await db().conversationMessage.create({
      data: { supplierId: supplier.id, direction: "OUTBOUND", sender: "AI", content: "mati di tengah", idempotencyKey: key },
    });
    const input = { supplierId: supplier.id, chatId, text: "mati di tengah", idempotencyKey: key };

    expect((await sendOutbound(db(), tg, input)).duplicate).toBe(true); // baru dibuat → pengirim lain mungkin masih jalan
    expect(tg.to(chatId)).toHaveLength(0);

    await db().conversationMessage.update({ where: { id: row.id }, data: { createdAt: new Date(Date.now() - 120_000) } });
    expect((await sendOutbound(db(), tg, input)).duplicate).toBe(false); // usang → kirim ulang
    expect(tg.to(chatId)).toHaveLength(1);
  });
});
