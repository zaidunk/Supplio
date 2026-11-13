import { MAX_MESSAGE_LENGTH } from "./constants";

/**
 * Penjaga pesan KELUAR (lapis pertahanan kedua setelah prompt). Pesan yang ditulis model diperiksa kode
 * sebelum dikirim ke manusia: kebocoran angka rahasia, nama supplier lain, komitmen transaksi, klaim sebagai
 * manusia, dan tautan. Ini defense-in-depth, bukan jaminan mutlak; aturan uang tetap ditegakkan di tempat lain.
 */
export interface GuardContext {
  restockBudget: number;
  /** Harga maksimum per satuan semua produk di request (rahasia internal). */
  maximumUnitPrices: number[];
  otherSupplierNames: string[];
}

export type GuardResult = { ok: true } | { ok: false; code: GuardCode; detail: string };

export type GuardCode =
  | "EMPTY"
  | "TOO_LONG"
  | "CONTAINS_URL"
  | "LEAKS_CONFIDENTIAL_AMOUNT"
  | "MENTIONS_OTHER_SUPPLIER"
  | "MAKES_COMMITMENT"
  | "CLAIMS_TO_BE_HUMAN";

/** Angka rupiah yang tampak di teks: "5.000.000", "5000000", "5 juta", "5jt", "17rb", "17 ribu", "17k". */
export function extractAmounts(text: string): Set<number> {
  const amounts = new Set<number>();
  // Akhiran harus diikuti batas kata agar "10 kg" tidak terbaca "10 k" (= 10.000).
  const pattern = /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)(?:\s*(juta|jt|ribu|rb|k)\b)?/gi;
  for (const match of text.matchAll(pattern)) {
    const raw = match[1];
    const suffix = match[2]?.toLowerCase();
    const isGrouped = /^\d{1,3}(?:[.,]\d{3})+$/.test(raw);
    const value = isGrouped ? Number(raw.replace(/[.,]/g, "")) : Number(raw.replace(",", "."));
    if (!Number.isFinite(value)) continue;
    const multiplier = suffix === "juta" || suffix === "jt" ? 1_000_000 : suffix ? 1_000 : 1;
    amounts.add(Math.round(value * multiplier));
    if (suffix) amounts.add(Math.round(value)); // "17rb" juga dibandingkan sebagai 17 bila konteksnya ribuan
  }
  return amounts;
}

const COMMITMENT_PATTERNS: RegExp[] = [
  /\b(?:kami|saya|kita)\s+(?:setuju|sepakat)\b/i,
  /\b(?:kami|saya|kita)\s+(?:pesan|order|ambil|beli)\b/i,
  /\b(?:kami|saya|kita)\s+(?:akan|pasti|siap)\s+(?:membeli|memesan|membayar|mengambil|order)\b/i,
  /\b(?:kami|saya)\s+terima(?!\s+kasih)\b/i,
  /\b(?:deal|sepakat|oke\s+deal)\b/i,
  /\bpesanan\s+(?:anda\s+|kami\s+)?(?:diterima|dikonfirmasi|disetujui|sah)\b/i,
  /\bpembayaran\s+(?:akan|segera|sudah)\b/i,
  /\b(?:kami|saya)\s+(?:akan\s+)?(?:transfer|bayar|membayar)\b/i,
  /\b(?:silakan|tolong|mohon)\s+(?:segera\s+)?(?:kirim(?:kan)?|proses)\s+(?:barang|pesanan|order)/i,
  /\bdp\b/i,
  /\buang\s+muka\b/i,
];

const HUMAN_CLAIM = /\b(?:saya|aku)\s+(?:adalah\s+)?(?:seorang\s+)?(?:manusia|orang|pemilik|owner|karyawan|staf|admin\s+toko)\b/i;
const URL_PATTERN = /(?:https?:\/\/|www\.|t\.me\/|\b[a-z0-9-]+\.(?:com|id|co|net|org|io|me)\b)/i;

export function guardOutbound(text: string, ctx: GuardContext): GuardResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, code: "EMPTY", detail: "Pesan kosong." };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, code: "TOO_LONG", detail: `Pesan melebihi ${MAX_MESSAGE_LENGTH} karakter.` };
  }
  if (URL_PATTERN.test(trimmed)) {
    return { ok: false, code: "CONTAINS_URL", detail: "Jangan menyertakan tautan atau alamat situs." };
  }

  const secrets = new Set<number>([ctx.restockBudget, ...ctx.maximumUnitPrices].filter((n) => Number.isFinite(n) && n > 0));
  const amounts = extractAmounts(trimmed);
  for (const secret of secrets) {
    if (amounts.has(secret)) {
      return { ok: false, code: "LEAKS_CONFIDENTIAL_AMOUNT", detail: "Pesan memuat angka batas internal. Jangan sebut budget atau harga maksimum." };
    }
  }

  const lower = trimmed.toLowerCase();
  for (const name of ctx.otherSupplierNames) {
    const n = name.trim().toLowerCase();
    if (n.length >= 3 && lower.includes(n)) {
      return { ok: false, code: "MENTIONS_OTHER_SUPPLIER", detail: "Jangan menyebut nama supplier lain." };
    }
  }

  if (HUMAN_CLAIM.test(trimmed)) {
    return { ok: false, code: "CLAIMS_TO_BE_HUMAN", detail: "Kamu adalah asisten AI; jangan mengaku sebagai manusia atau pemilik." };
  }
  for (const pattern of COMMITMENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { ok: false, code: "MAKES_COMMITMENT", detail: "Pesan terdengar seperti komitmen pembelian/pembayaran. Kamu tidak boleh berkomitmen; hanya pemilik yang menyetujui." };
    }
  }
  return { ok: true };
}

/** Teks aman per jenis pesan, dipakai bila model gagal menghasilkan pesan yang lolos penjaga. */
export const SAFE_FALLBACKS = {
  CLARIFICATION:
    "Mohon konfirmasi detail penawaran: harga per satuan, stok tersedia, minimum order, ongkos kirim, dan estimasi lead time. Terima kasih.",
  COUNTER_OFFER: "Terima kasih atas penawarannya. Apakah ada ruang untuk harga atau ongkos kirim yang lebih baik? Terima kasih.",
  REPLY:
    "Terima kasih atas informasinya. Penawaran akan kami teruskan kepada pemilik untuk ditinjau. Ini belum merupakan pemesanan.",
} as const;

export type MessageKind = keyof typeof SAFE_FALLBACKS;

/** Penutup sopan yang dikirim kode (bukan model) saat sesi ditutup tanpa pesan dari model. */
export const CLOSING_MESSAGES = {
  DECLINED: "Baik, terima kasih atas informasinya. Kami catat bahwa saat ini barang tersebut tidak tersedia.",
  GIVE_UP:
    "Terima kasih atas waktunya. Karena detail penawaran belum lengkap, permintaan ini kami hentikan untuk saat ini. Ini bukan pemesanan.",
  CONFIRMED:
    "Terima kasih, penawaran Anda sudah kami catat dan akan ditinjau oleh pemilik. Ini belum merupakan pemesanan.",
} as const;

export function buildClarificationFallback(missing: string[]): string {
  if (missing.length === 0) return SAFE_FALLBACKS.CLARIFICATION;
  return `Terima kasih. Mohon dijelaskan lebih tegas: ${missing.slice(0, 6).join("; ")}. Terima kasih.`;
}
