import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ACTIVE_SESSION_STATUSES, FINAL_SESSION_STATUSES } from "@/lib/procurement/sessions";
import { TelegramApiError, createTelegramClient } from "@/lib/telegram/client";
import { INVALID_LINK_REPLY, NO_ACTIVE_REQUEST_REPLY, buildConnectedMessage, buildConsentMessage, buildOutreachMessage } from "@/lib/telegram/messages";
import { hashToken } from "@/lib/telegram/onboarding";
import { secretMatches } from "@/lib/telegram/secret";
import { rawUpdateEnvelope, telegramUpdateSchema } from "@/lib/telegram/types";

const TOKEN = "123456:SECRET-TOKEN-ABC";

type Reply = { status: number; body: unknown } | "network-error";

/** fetch palsu yang memutar daftar respons dan mencatat setiap panggilan. */
function fakeFetch(replies: Reply[]) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (reply === "network-error") throw new TypeError(`fetch failed for ${String(url)}`); // pesan asli memuat URL+token
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "Content-Type": "application/json" } });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const ok = (result: unknown): Reply => ({ status: 200, body: { ok: true, result } });
const err = (status: number, description: string, retryAfter?: number): Reply => ({
  status,
  body: { ok: false, description, ...(retryAfter ? { parameters: { retry_after: retryAfter } } : {}) },
});

const client = (replies: Reply[], maxAttempts = 3) => {
  const f = fakeFetch(replies);
  const sleeps: number[] = [];
  const tg = createTelegramClient({
    token: TOKEN,
    fetchImpl: f.impl,
    sleep: async (ms) => void sleeps.push(ms),
    maxAttempts,
  });
  return { tg, sleeps, calls: f.calls };
};

describe("klien Telegram", () => {
  it("mengirim pesan dan mengembalikan message_id; tombol inline menjadi reply_markup", async () => {
    const { tg, calls } = client([ok({ message_id: 77 })]);
    const r = await tg.sendMessage({ chatId: 42, text: "Halo", inlineKeyboard: [[{ text: "Ya", callback_data: "link:abc" }]] });
    expect(r).toEqual({ messageId: 77 });
    expect(calls[0].url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(calls[0].body).toMatchObject({
      chat_id: 42,
      text: "Halo",
      reply_markup: { inline_keyboard: [[{ text: "Ya", callback_data: "link:abc" }]] },
    });
  });

  it("answerCallbackQuery mengirim callback_query_id", async () => {
    const { tg, calls } = client([ok(true)]);
    await tg.answerCallbackQuery("cb-1", "Terhubung");
    expect(calls[0].url.endsWith("/answerCallbackQuery")).toBe(true);
    expect(calls[0].body).toEqual({ callback_query_id: "cb-1", text: "Terhubung" });
  });

  it("429 menghormati retry_after lalu berhasil", async () => {
    const { tg, sleeps, calls } = client([err(429, "Too Many Requests", 2), ok({ message_id: 1 })]);
    await expect(tg.sendMessage({ chatId: 1, text: "x" })).resolves.toEqual({ messageId: 1 });
    expect(sleeps).toEqual([2000]);
    expect(calls).toHaveLength(2);
  });

  it("retry_after yang sangat besar dibatasi 30 detik", async () => {
    const { tg, sleeps } = client([err(429, "Too Many Requests", 3600), ok({ message_id: 1 })]);
    await tg.sendMessage({ chatId: 1, text: "x" });
    expect(sleeps).toEqual([30_000]);
  });

  it("5xx di-retry dengan backoff", async () => {
    const { tg, sleeps, calls } = client([err(502, "Bad Gateway"), err(500, "oops"), ok({ message_id: 9 })]);
    await expect(tg.sendMessage({ chatId: 1, text: "x" })).resolves.toEqual({ messageId: 9 });
    expect(sleeps).toEqual([500, 1500]);
    expect(calls).toHaveLength(3);
  });

  it("galat jaringan di-retry lalu gagal TANPA membocorkan token di pesan galat", async () => {
    const { tg, calls } = client(["network-error"]);
    const e = await tg.sendMessage({ chatId: 1, text: "x" }).catch((x) => x);
    expect(e).toBeInstanceOf(TelegramApiError);
    expect(calls).toHaveLength(3);
    expect(String(e.message)).not.toContain(TOKEN);
    expect(String(e.message)).not.toContain("SECRET-TOKEN");
  });

  it("403 (bot diblokir) langsung gagal tanpa retry dan ditandai blocked/gone", async () => {
    const { tg, calls } = client([err(403, "Forbidden: bot was blocked by the user")]);
    const e = (await tg.sendMessage({ chatId: 1, text: "x" }).catch((x) => x)) as TelegramApiError;
    expect(calls).toHaveLength(1);
    expect(e.isBlockedOrGone).toBe(true);
    expect(e.message).not.toContain(TOKEN);
  });

  it("400 'chat not found' dianggap tidak terjangkau; 400 lain gagal tanpa retry dan bukan blocked", async () => {
    const gone = (await client([err(400, "Bad Request: chat not found")]).tg.sendMessage({ chatId: 1, text: "x" }).catch((x) => x)) as TelegramApiError;
    expect(gone.isBlockedOrGone).toBe(true);

    const c = client([err(400, "Bad Request: message is too long")]);
    const other = (await c.tg.sendMessage({ chatId: 1, text: "x" }).catch((x) => x)) as TelegramApiError;
    expect(other.isBlockedOrGone).toBe(false);
    expect(c.calls).toHaveLength(1);
  });

  it("menghormati baseUrl kustom (untuk uji e2e)", async () => {
    const f = fakeFetch([ok({ message_id: 1 })]);
    const tg = createTelegramClient({ token: TOKEN, baseUrl: "http://localhost:3200/", fetchImpl: f.impl });
    await tg.sendMessage({ chatId: 1, text: "x" });
    expect(f.calls[0].url).toBe(`http://localhost:3200/bot${TOKEN}/sendMessage`);
  });
});

describe("secret webhook", () => {
  it("cocok hanya bila persis sama; null dan panjang berbeda ditolak", () => {
    expect(secretMatches("rahasia-panjang", "rahasia-panjang")).toBe(true);
    expect(secretMatches("rahasia-panjang", "rahasia-pendek")).toBe(false);
    expect(secretMatches("r", "rahasia-panjang")).toBe(false);
    expect(secretMatches(null, "rahasia-panjang")).toBe(false);
    expect(secretMatches("", "rahasia-panjang")).toBe(false);
  });
});

describe("token onboarding", () => {
  it("di-hash dengan SHA-256 (hex 64) dan deterministik", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
    expect(hashToken("abc")).not.toContain("abc");
  });
});

describe("template pesan (§1, §5)", () => {
  const outreach = buildOutreachMessage({
    businessName: "Warung Bu Sari",
    supplierName: "Supplier A",
    items: [
      { productName: "Bawang Putih", quantity: "28.000", unit: "kg", maxDeliveryDays: 2 },
      { productName: "Minyak Goreng", quantity: "52", unit: "liter", maxDeliveryDays: 2 },
    ],
  });

  it("mengungkapkan bahwa pengirim adalah AI dan bukan manusia", () => {
    for (const text of [outreach, buildConsentMessage({ businessName: "Warung Bu Sari", supplierName: "Supplier A" })]) {
      expect(text).toMatch(/asisten AI/i);
      expect(text).toMatch(/bukan manusia/i);
    }
  });

  it("memuat kebutuhan spesifik (barang, jumlah, satuan, batas kedatangan) dan meminta data penawaran", () => {
    expect(outreach).toContain("Bawang Putih: 28 kg, tiba maksimal 2 hari");
    expect(outreach).toContain("Minyak Goreng: 52 liter");
    for (const k of ["harga per satuan", "stok", "minimum order", "ongkos kirim", "lead time"]) expect(outreach.toLowerCase()).toContain(k);
  });

  it("menegaskan ini bukan pemesanan dan tidak membocorkan budget", () => {
    expect(outreach).toMatch(/bukan pemesanan/i);
    expect(outreach.toLowerCase()).not.toContain("budget");
    expect(outreach).not.toMatch(/Rp\s?\d/);
    for (const t of [NO_ACTIVE_REQUEST_REPLY, INVALID_LINK_REPLY, buildConnectedMessage({ businessName: "X" })]) {
      expect(t.toLowerCase()).not.toContain("budget");
    }
  });

  it("tidak menjanjikan pembayaran/pesanan", () => {
    const all = [outreach, buildConsentMessage({ businessName: "X", supplierName: "Y" })].join("\n").toLowerCase();
    expect(all).toContain("tidak dapat memesan atau menjanjikan pembayaran");
  });
});

describe("skema update Telegram (data tidak tepercaya)", () => {
  it("menerima pesan teks dan membuang field tak dikenal", () => {
    const u = telegramUpdateSchema.parse({
      update_id: 10,
      message: { message_id: 5, from: { id: 99, is_bot: false, first_name: "X" }, chat: { id: 99, type: "private" }, text: "Rp 17rb", date: 1, evil: "x" },
    });
    expect(u.message?.text).toBe("Rp 17rb");
    expect(u.message).not.toHaveProperty("evil");
  });

  it("menerima callback_query dan menolak callback_data lebih dari 64 karakter", () => {
    const base = { update_id: 11, callback_query: { id: "cb", from: { id: 1 }, data: "link:" + "a".repeat(36) } };
    expect(telegramUpdateSchema.safeParse(base).success).toBe(true);
    expect(telegramUpdateSchema.safeParse({ ...base, callback_query: { ...base.callback_query, data: "x".repeat(65) } }).success).toBe(false);
  });

  it("menolak update tanpa update_id yang valid", () => {
    expect(telegramUpdateSchema.safeParse({ message: {} }).success).toBe(false);
    expect(rawUpdateEnvelope.safeParse({ update_id: -1 }).success).toBe(false);
    expect(rawUpdateEnvelope.safeParse({ update_id: "7" }).success).toBe(false);
    expect(rawUpdateEnvelope.safeParse({ update_id: 7, apa_saja: true }).success).toBe(true);
  });
});

describe("status sesi", () => {
  it("ACTIVE_SESSION_STATUSES identik dengan index unik parsial di migrasi, dan terpisah dari status final", () => {
    const dir = join(process.cwd(), "prisma", "migrations");
    const sql = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .map((n) => readFileSync(join(dir, n, "migration.sql"), "utf8"))
      .filter((s) => s.includes('"NegotiationSession_one_active_per_supplier"'))
      .at(-1)!;
    const m = sql.match(/"NegotiationSession_one_active_per_supplier"[\s\S]*?WHERE "status" IN \(([^)]*)\)/);
    const fromDb = [...m![1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
    expect(new Set(fromDb)).toEqual(new Set(ACTIVE_SESSION_STATUSES));
    expect(ACTIVE_SESSION_STATUSES.some((s) => (FINAL_SESSION_STATUSES as readonly string[]).includes(s))).toBe(false);
  });
});
