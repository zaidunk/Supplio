import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_LENGTH } from "@/lib/ai/constants";
import {
  CLOSING_MESSAGES,
  SAFE_FALLBACKS,
  buildClarificationFallback,
  extractAmounts,
  guardOutbound,
  type GuardContext,
} from "@/lib/ai/guard";

const ctx: GuardContext = {
  restockBudget: 5_000_000,
  maximumUnitPrices: [17_000, 45_000],
  otherSupplierNames: ["Supplier B (seed)", "Toko Maju Jaya"],
};
const verdict = (text: string) => guardOutbound(text, ctx);
const blocked = (text: string) => {
  const v = verdict(text);
  return v.ok ? null : v.code;
};

describe("extractAmounts", () => {
  it.each([
    ["Rp 5.000.000", 5_000_000],
    ["5000000", 5_000_000],
    ["5,000,000", 5_000_000],
    ["5 juta", 5_000_000],
    ["5jt", 5_000_000],
    ["17rb", 17_000],
    ["17 ribu", 17_000],
    ["17k", 17_000],
    ["16.500", 16_500],
    ["2,5 juta", 2_500_000],
  ])("membaca %s sebagai %i", (text, expected) => {
    expect(extractAmounts(text).has(expected)).toBe(true);
  });

  it('"10 kg" tidak terbaca sebagai 10.000 (akhiran k harus berdiri sendiri)', () => {
    const a = extractAmounts("stok 10 kg dan 5 kardus");
    expect(a.has(10)).toBe(true);
    expect(a.has(10_000)).toBe(false);
    expect(a.has(5_000)).toBe(false);
  });
});

describe("guardOutbound — rahasia internal", () => {
  it.each([
    "Budget kami 5.000.000 rupiah",
    "Maksimal total 5000000 ya",
    "Kami punya dana 5 juta",
    "plafon 5jt",
    "Harga paling tinggi yang bisa kami terima 17.000",
    "maksimal 17rb per kg",
    "batasnya 45 ribu",
  ])("memblokir kebocoran: %s", (text) => {
    expect(blocked(text)).toBe("LEAKS_CONFIDENTIAL_AMOUNT");
  });

  it("tidak salah blokir angka biasa (harga penawaran, stok, jumlah)", () => {
    expect(verdict("Harga 16.500 per kg, stok 100 kg, MOQ 10 kg, ongkir 25.000, lead time 2 hari.").ok).toBe(true);
    expect(verdict("Kami butuh 28 kg dan 52 liter, tiba maksimal 2 hari.").ok).toBe(true);
  });

  it("memblokir nama supplier lain (tanpa memandang huruf besar-kecil)", () => {
    expect(blocked("Supplier B (seed) menawar lebih murah dari Anda")).toBe("MENTIONS_OTHER_SUPPLIER");
    expect(blocked("katanya toko maju jaya bisa 15.000")).toBe("MENTIONS_OTHER_SUPPLIER");
    expect(verdict("Ada penawaran lain yang lebih rendah. Apakah bisa menyesuaikan?").ok).toBe(true);
  });
});

describe("guardOutbound — komitmen dan identitas", () => {
  it.each([
    "Baik, kami setuju memesan semuanya",
    "Oke kami pesan 100 kg",
    "Kami ambil yang 16.000",
    "Deal ya",
    "Kami sepakat dengan harga itu",
    "Kami akan membayar besok",
    "Pembayaran akan kami transfer sore ini",
    "Pesanan Anda dikonfirmasi",
    "Silakan kirim barangnya sekarang",
    "Tolong segera kirimkan barang ke toko",
    "Kami kirim DP 50 persen",
    "Saya terima penawaran Anda",
  ])("memblokir komitmen: %s", (text) => {
    expect(blocked(text)).toBe("MAKES_COMMITMENT");
  });

  it("mengizinkan ungkapan sopan yang bukan komitmen", () => {
    for (const text of [
      "Terima kasih atas penawarannya.",
      "Kami ucapkan terima kasih. Penawaran akan ditinjau oleh pemilik; ini belum merupakan pemesanan.",
      "Saya tidak dapat memesan atau menjanjikan pembayaran; keputusan ada pada pemilik.",
      "Mohon konfirmasi stok dan ongkir.",
    ]) {
      expect(verdict(text).ok).toBe(true);
    }
  });

  it("memblokir pengakuan sebagai manusia/pemilik, mengizinkan mengaku AI", () => {
    expect(blocked("Saya manusia kok, bukan bot")).toBe("CLAIMS_TO_BE_HUMAN");
    expect(blocked("Saya adalah pemilik toko ini")).toBe("CLAIMS_TO_BE_HUMAN");
    expect(blocked("Saya karyawan di sini")).toBe("CLAIMS_TO_BE_HUMAN");
    expect(verdict("Saya asisten AI Supplio, bukan manusia.").ok).toBe(true);
  });
});

describe("guardOutbound — bentuk pesan", () => {
  it.each(["https://evil.example/login", "kunjungi www.toko-palsu.id", "chat di t.me/penipu", "buka toko.com sekarang"])(
    "memblokir tautan: %s",
    (text) => {
      expect(blocked(text)).toBe("CONTAINS_URL");
    },
  );

  it("tidak menganggap angka berdesimal sebagai domain", () => {
    expect(verdict("Harga 16.500 dan 2.5 kg").ok).toBe(true);
  });

  it("menolak pesan kosong dan terlalu panjang", () => {
    expect(blocked("   \n ")).toBe("EMPTY");
    expect(blocked("a".repeat(MAX_MESSAGE_LENGTH + 1))).toBe("TOO_LONG");
    expect(verdict("a".repeat(MAX_MESSAGE_LENGTH)).ok).toBe(true);
  });
});

describe("teks aman bawaan kode", () => {
  it("semua teks bawaan lolos penjaga sendiri dan tidak berkomitmen", () => {
    for (const text of [...Object.values(SAFE_FALLBACKS), ...Object.values(CLOSING_MESSAGES), buildClarificationFallback([])]) {
      expect(verdict(text).ok, text).toBe(true);
    }
  });

  it("klarifikasi bawaan memuat daftar kekurangan dan dibatasi enam butir", () => {
    const text = buildClarificationFallback(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(text).toContain("a; b; c; d; e; f");
    expect(text).not.toContain("f; g");
    expect(text).not.toMatch(/\bg\b/);
    expect(buildClarificationFallback(["stok Gula"])).toContain("stok Gula");
  });
});
