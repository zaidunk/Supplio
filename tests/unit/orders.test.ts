import { describe, expect, it } from "vitest";
import { generatePoNumber, lineCost } from "@/lib/procurement/orders";
import { buildOrderMessage } from "@/lib/telegram/messages";
import { approveSchema, receiptSchema, rejectSchema } from "@/lib/validation/orders";

describe("generatePoNumber", () => {
  it("memakai tanggal Asia/Jakarta (WIB, UTC+7), bukan UTC", () => {
    // 18:00 UTC tanggal 13 = 01:00 WIB tanggal 14.
    expect(generatePoNumber(new Date("2026-11-13T18:00:00Z"))).toMatch(/^PO-20261114-[0-9A-F]{6}$/);
    expect(generatePoNumber(new Date("2026-11-13T16:59:59Z"))).toMatch(/^PO-20261113-[0-9A-F]{6}$/);
  });

  it("nomor berbeda pada pemanggilan berturut-turut", () => {
    const now = new Date("2026-11-13T05:00:00Z");
    const numbers = new Set(Array.from({ length: 500 }, () => generatePoNumber(now)));
    expect(numbers.size).toBe(500);
  });
});

describe("lineCost", () => {
  it("dibulatkan ke atas ke rupiah utuh", () => {
    expect(lineCost(16_500, "28")).toBe(462_000);
    expect(lineCost(12_345, "2.5")).toBe(30_863); // 30.862,5
    expect(lineCost(1, "0.001")).toBe(1);
    expect(lineCost(39_000, { toString: () => "12.000" })).toBe(468_000);
  });
});

describe("buildOrderMessage", () => {
  const text = buildOrderMessage({
    businessName: "Warung Bu Sari",
    supplierName: "Supplier A",
    poNumber: "PO-20261113-A1B2C3",
    items: [
      { productName: "Gula Pasir", quantity: "28.000", unit: "kg", unitPrice: 16_500, lineCost: 462_000 },
      { productName: "Minyak Goreng", quantity: "20", unit: "liter", unitPrice: 17_200, lineCost: 344_000 },
    ],
    shippingFee: 25_000,
    totalCost: 831_000,
    leadTimeDays: 1,
  });

  it("memuat nomor PO, item, ongkir, total, dan estimasi tiba", () => {
    expect(text).toContain("PESANAN RESMI PO-20261113-A1B2C3");
    expect(text).toContain("Gula Pasir: 28 kg");
    expect(text).toContain("Minyak Goreng: 20 liter");
    expect(text).toMatch(/Ongkos kirim: Rp\s?25\.000/);
    expect(text).toMatch(/Total: Rp\s?831\.000/);
    expect(text).toContain("Estimasi tiba: 1 hari");
    expect(text).toContain("Mohon cantumkan nomor PO PO-20261113-A1B2C3");
  });

  it("menyatakan pesan berasal dari AI atas persetujuan pemilik dan tidak memuat istilah budget", () => {
    expect(text).toMatch(/asisten AI Supplio atas persetujuan pemilik/);
    expect(text.toLowerCase()).not.toContain("budget");
  });

  it("estimasi tiba dihilangkan bila tidak diketahui", () => {
    const t = buildOrderMessage({ businessName: "X", supplierName: "Y", poNumber: "PO-1", items: [], shippingFee: 0, totalCost: 0, leadTimeDays: null });
    expect(t).not.toContain("Estimasi tiba");
  });
});

describe("skema validasi approval, reject, dan penerimaan", () => {
  const uuid = "3f2b8c1e-5d4a-4e7b-9a6c-1d2e3f4a5b6c";

  it("approve: semua opsional, kunci minimal 8 karakter, field asing ditolak (businessId tidak bisa disuntik)", () => {
    expect(approveSchema.safeParse({}).success).toBe(true);
    expect(approveSchema.safeParse({ recommendationId: uuid, idempotencyKey: "kunci-ok-01" }).success).toBe(true);
    expect(approveSchema.safeParse({ idempotencyKey: "pendek" }).success).toBe(false);
    expect(approveSchema.safeParse({ recommendationId: "bukan-uuid" }).success).toBe(false);
    expect(approveSchema.safeParse({ businessId: "x" }).success).toBe(false);
    expect(approveSchema.safeParse({ approvedByOwner: true }).success).toBe(false);
  });

  it("reject: alasan opsional maksimal 200 karakter", () => {
    expect(rejectSchema.safeParse({}).success).toBe(true);
    expect(rejectSchema.safeParse({ reason: "Harga kemahalan" }).success).toBe(true);
    expect(rejectSchema.safeParse({ reason: "x".repeat(201) }).success).toBe(false);
  });

  it("penerimaan: kunci idempotensi WAJIB, minimal satu barang, kuantitas desimal valid", () => {
    const ok = { items: [{ productId: uuid, receivedQuantity: "10.5" }], idempotencyKey: "terima-0000001" };
    expect(receiptSchema.safeParse(ok).success).toBe(true);
    expect(receiptSchema.safeParse({ items: ok.items }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...ok, items: [] }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...ok, items: [{ productId: uuid, receivedQuantity: "-1" }] }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...ok, items: [{ productId: uuid, receivedQuantity: "1.2345" }] }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...ok, items: [{ productId: "x", receivedQuantity: "1" }] }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...ok, businessId: "x" }).success).toBe(false);
  });
});
