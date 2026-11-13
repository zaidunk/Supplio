import { describe, expect, it } from "vitest";
import { evaluateQuotation, saveQuotationSchema, type ContextProduct, type SaveQuotationInput } from "@/lib/ai/quotation";

const NOW = new Date("2026-11-13T05:00:00Z");
const gula: ContextProduct = { productId: "p-gula", productName: "Gula Pasir", unit: "kg", quantityScale: 1 };
const minyak: ContextProduct = { productId: "p-minyak", productName: "Minyak Goreng", unit: "liter", quantityScale: 0 };

const full = (o: Partial<SaveQuotationInput> = {}): SaveQuotationInput => ({
  items: [{ productId: gula.productId, unitPrice: 16500, priceBasis: "PER_BASE_UNIT", availableQuantity: 100, minimumOrderQuantity: 10 }],
  shippingFee: 25000,
  leadTimeDays: 1,
  ...o,
});

const missingOf = (e: ReturnType<typeof evaluateQuotation>) => (e.status === "NEEDS_CLARIFICATION" ? e.missing.join(" | ") : "");

describe("evaluateQuotation — penawaran lengkap", () => {
  it("lengkap → CONFIRMED dengan data ternormalisasi", () => {
    const e = evaluateQuotation(full(), [gula], NOW);
    expect(e).toMatchObject({
      status: "CONFIRMED",
      shippingFee: 25000,
      leadTimeDays: 1,
      validUntil: null,
      items: [{ productId: "p-gula", quotedUnitPrice: 16500, availableQuantity: "100", minimumOrderQuantity: "10", packSize: null }],
    });
  });

  it("ongkir 0 dan MOQ 1 yang eksplisit sah (nol bukan 'tidak disebut')", () => {
    const e = evaluateQuotation(full({ shippingFee: 0, items: [{ productId: "p-gula", unitPrice: 16500, availableQuantity: 5, minimumOrderQuantity: 1 }] }), [gula], NOW);
    expect(e.status).toBe("CONFIRMED");
  });

  it("dua produk, satu dinyatakan tidak tersedia → tetap CONFIRMED untuk yang ada", () => {
    const e = evaluateQuotation(full({ unavailableProductIds: ["p-minyak"] }), [gula, minyak], NOW);
    expect(e).toMatchObject({ status: "CONFIRMED", declinedProductIds: ["p-minyak"] });
    if (e.status === "CONFIRMED") expect(e.items.map((i) => i.productId)).toEqual(["p-gula"]);
  });

  it("masa berlaku di masa depan diterima", () => {
    const e = evaluateQuotation(full({ validUntil: "2026-11-20" }), [gula], NOW);
    expect(e.status === "CONFIRMED" && e.validUntil?.toISOString().startsWith("2026-11-20")).toBe(true);
  });

  it("presisi desimal sampai 3 angka diterima", () => {
    const e = evaluateQuotation(full({ items: [{ productId: "p-gula", unitPrice: 16500, availableQuantity: 12.5, minimumOrderQuantity: 0.5 }] }), [gula], NOW);
    expect(e).toMatchObject({ status: "CONFIRMED", items: [{ availableQuantity: "12.5", minimumOrderQuantity: "0.5" }] });
  });
});

describe("evaluateQuotation — normalisasi satuan", () => {
  it("harga per kemasan dikonversi ke harga per satuan dasar", () => {
    const e = evaluateQuotation(
      full({ items: [{ productId: "p-minyak", unitPrice: 216000, priceBasis: "PER_PACK", packSize: 12, availableQuantity: 120, minimumOrderQuantity: 12 }] }),
      [minyak],
      NOW,
    );
    expect(e).toMatchObject({ status: "CONFIRMED", items: [{ quotedUnitPrice: 18000, packSize: "12" }] });
  });

  it("harga per kemasan tanpa isi kemasan → minta klarifikasi (tidak ditebak)", () => {
    const e = evaluateQuotation(full({ items: [{ productId: "p-minyak", unitPrice: 216000, priceBasis: "PER_PACK", availableQuantity: 120, minimumOrderQuantity: 12 }] }), [minyak], NOW);
    expect(e.status).toBe("NEEDS_CLARIFICATION");
    expect(missingOf(e)).toMatch(/isi per kemasan/);
  });

  it("harga per kemasan yang tidak habis dibagi → minta harga per satuan, tanpa pembulatan diam-diam", () => {
    const e = evaluateQuotation(
      full({ items: [{ productId: "p-minyak", unitPrice: 100000, priceBasis: "PER_PACK", packSize: 12, availableQuantity: 120, minimumOrderQuantity: 12 }] }),
      [minyak],
      NOW,
    );
    expect(e.status).toBe("NEEDS_CLARIFICATION");
    expect(missingOf(e)).toMatch(/tidak habis dibagi/);
  });

  it("harga per satuan berpecahan bukan rupiah utuh ditolak", () => {
    const e = evaluateQuotation(full({ items: [{ productId: "p-gula", unitPrice: 16500.5, availableQuantity: 100, minimumOrderQuantity: 1 }] }), [gula], NOW);
    expect(e.status).toBe("NEEDS_CLARIFICATION");
    expect(missingOf(e)).toMatch(/rupiah utuh/);
  });
});

describe("evaluateQuotation — tidak ada data yang ditebak", () => {
  it.each([
    ["harga", { items: [{ productId: "p-gula", availableQuantity: 100, minimumOrderQuantity: 10 }] }, /harga per kg/],
    ["stok", { items: [{ productId: "p-gula", unitPrice: 16500, minimumOrderQuantity: 10 }] }, /stok tersedia/],
    ["MOQ", { items: [{ productId: "p-gula", unitPrice: 16500, availableQuantity: 100 }] }, /minimum order/],
    ["ongkir", { shippingFee: undefined }, /ongkos kirim/],
    ["lead time", { leadTimeDays: undefined }, /lead time/],
  ] as [string, Partial<SaveQuotationInput>, RegExp][])("%s tidak disebut → NEEDS_CLARIFICATION", (_name, override, pattern) => {
    const e = evaluateQuotation({ ...full(), ...override }, [gula], NOW);
    expect(e.status).toBe("NEEDS_CLARIFICATION");
    expect(missingOf(e)).toMatch(pattern);
  });

  it('"sekitar 17 ribu" (ditandai model sebagai tidak tegas) → NEEDS_CLARIFICATION, tidak CONFIRMED', () => {
    const e = evaluateQuotation(
      full({ items: [{ productId: "p-gula", availableQuantity: 100, minimumOrderQuantity: 10 }], unclearPoints: ["harga 'sekitar 17 ribu' tidak pasti"] }),
      [gula],
      NOW,
    );
    expect(e.status).toBe("NEEDS_CLARIFICATION");
    expect(missingOf(e)).toMatch(/sekitar 17 ribu/);
  });

  it("walau semua angka terisi, titik tidak tegas dari model tetap menahan CONFIRMED", () => {
    const e = evaluateQuotation(full({ unclearPoints: ["satuan tidak disebut"] }), [gula], NOW);
    expect(e.status).toBe("NEEDS_CLARIFICATION");
  });

  it("produk yang diminta tapi tidak ditanggapi ditandai kurang", () => {
    const e = evaluateQuotation(full(), [gula, minyak], NOW);
    expect(e.status).toBe("NEEDS_CLARIFICATION");
    expect(missingOf(e)).toMatch(/Minyak Goreng: belum ada tanggapan/);
  });

  it.each([
    ["harga negatif", { unitPrice: -5 }],
    ["harga nol", { unitPrice: 0 }],
    ["stok negatif", { availableQuantity: -1 }],
    ["MOQ negatif", { minimumOrderQuantity: -2 }],
    ["stok lebih dari 3 desimal", { availableQuantity: 1.2345 }],
    ["harga NaN", { unitPrice: Number.NaN }],
  ] as [string, Record<string, number>][])("%s → tidak CONFIRMED", (_n, patch) => {
    const e = evaluateQuotation(full({ items: [{ productId: "p-gula", unitPrice: 16500, availableQuantity: 100, minimumOrderQuantity: 10, ...patch }] }), [gula], NOW);
    expect(e.status).toBe("NEEDS_CLARIFICATION");
  });

  it.each([
    ["ongkir pecahan", { shippingFee: 100.5 }],
    ["ongkir negatif", { shippingFee: -1 }],
    ["lead time negatif", { leadTimeDays: -1 }],
    ["lead time 400 hari", { leadTimeDays: 400 }],
    ["lead time pecahan", { leadTimeDays: 1.5 }],
  ] as [string, Partial<SaveQuotationInput>][])("%s → tidak CONFIRMED", (_n, patch) => {
    expect(evaluateQuotation(full(patch), [gula], NOW).status).toBe("NEEDS_CLARIFICATION");
  });

  it("masa berlaku sudah lewat atau tidak terbaca → tidak CONFIRMED", () => {
    expect(evaluateQuotation(full({ validUntil: "2026-01-01" }), [gula], NOW).status).toBe("NEEDS_CLARIFICATION");
    expect(evaluateQuotation(full({ validUntil: "besok-lusa" }), [gula], NOW).status).toBe("NEEDS_CLARIFICATION");
  });

  it("produk fiktif dari model diabaikan; produk yang sah tetap dievaluasi", () => {
    const e = evaluateQuotation(
      full({ items: [{ productId: "p-gula", unitPrice: 16500, availableQuantity: 100, minimumOrderQuantity: 10 }, { productId: "produk-di-bisnis-lain", unitPrice: 1, availableQuantity: 1, minimumOrderQuantity: 1 }] }),
      [gula],
      NOW,
    );
    expect(e).toMatchObject({ status: "CONFIRMED" });
    if (e.status === "CONFIRMED") expect(e.items.map((i) => i.productId)).toEqual(["p-gula"]);
  });

  it("produk yang disebut dua kali ditandai", () => {
    const row = { productId: "p-gula", unitPrice: 16500, availableQuantity: 100, minimumOrderQuantity: 10 };
    const e = evaluateQuotation(full({ items: [row, { ...row, unitPrice: 16000 }] }), [gula], NOW);
    expect(e.status).toBe("NEEDS_CLARIFICATION");
    expect(missingOf(e)).toMatch(/lebih dari satu kali/);
  });
});

describe("evaluateQuotation — penolakan supplier", () => {
  it("supplierDeclinedAll → DECLINED", () => {
    expect(evaluateQuotation({ supplierDeclinedAll: true }, [gula], NOW)).toEqual({ status: "DECLINED" });
  });

  it("semua produk dinyatakan tidak tersedia → DECLINED", () => {
    expect(evaluateQuotation({ unavailableProductIds: ["p-gula", "p-minyak"] }, [gula, minyak], NOW).status).toBe("DECLINED");
  });

  it("unavailableProductIds fiktif tidak membuat produk sah dianggap tidak tersedia", () => {
    const e = evaluateQuotation({ unavailableProductIds: ["fiktif"] }, [gula], NOW);
    expect(e.status).toBe("NEEDS_CLARIFICATION");
  });
});

describe("skema tool saveQuotation", () => {
  it("menerima masukan parsial (semua field opsional) dan membuang field tak dikenal", () => {
    const parsed = saveQuotationSchema.parse({ items: [{ productId: "x" }], tidakDikenal: 1 });
    expect(parsed).not.toHaveProperty("tidakDikenal");
    expect(saveQuotationSchema.safeParse({}).success).toBe(true);
  });

  it("menolak tipe yang salah dari model", () => {
    expect(saveQuotationSchema.safeParse({ shippingFee: "dua puluh lima ribu" }).success).toBe(false);
    expect(saveQuotationSchema.safeParse({ items: [{ productId: "x", priceBasis: "PER_KARUNG" }] }).success).toBe(false);
  });
});
