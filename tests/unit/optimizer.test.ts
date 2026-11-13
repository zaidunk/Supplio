import { describe, expect, it } from "vitest";
import { solveProcurement } from "@/lib/optimization/solve";
import type { OptimizerResult } from "@/lib/optimization/types";
import { validateSolution } from "@/lib/optimization/validate";
import { NOW, item, makeInput, qi, quote } from "./optimizer-fixtures";

function optimal(r: OptimizerResult) {
  if (r.status !== "OPTIMAL") throw new Error(`expected OPTIMAL, got ${r.status}: ${JSON.stringify(r)}`);
  return r;
}
function infeasible(r: OptimizerResult) {
  if (r.status !== "NO_FEASIBLE_SOLUTION") throw new Error(`expected NO_FEASIBLE_SOLUTION, got ${r.status}`);
  return r;
}
const qtyBySupplier = (r: ReturnType<typeof optimal>, productId: string) =>
  Object.fromEntries(r.lines.filter((l) => l.productId === productId).map((l) => [l.supplierId, l.quantity]));

describe("optimizer — acceptance test 6: supplier termurah tidak valid → kombinasi valid lain", () => {
  const items = [item({ productId: "bawang", productName: "Bawang Putih", requiredQuantity: "28", maxDeliveryDays: 2 })];

  it("melewati supplier termurah yang lead time-nya terlalu lama dan MOQ-nya melebihi batas beli", () => {
    const r = optimal(
      solveProcurement(
        makeInput({
          items,
          quotations: [
            quote("X", [qi("x1", "bawang", 37_000)], { leadTimeDays: 5 }), // termurah, tapi terlambat
            quote("Y", [qi("y1", "bawang", 36_000, { minimumOrderQuantity: "50" })]), // termurah, MOQ 50 > 28
            quote("Z", [qi("z1", "bawang", 39_000)], { shippingFee: 15_000 }),
          ],
        }),
      ),
    );
    expect(qtyBySupplier(r, "bawang")).toEqual({ Z: "28" });
    expect(r.totalCost).toBe(28 * 39_000 + 15_000);
    expect(r.ineligible.map((i) => [i.supplierId, i.reason]).sort()).toEqual([
      ["X", "LEAD_TIME_TOO_LONG"],
      ["Y", "MOQ_OR_PACK_EXCEEDS_LIMIT"],
    ]);
  });

  it("MOQ boleh dipenuhi bila kelebihan beli diizinkan, dan hanya bila lebih murah", () => {
    const base = {
      quotations: [
        quote("X", [qi("x1", "p", 20, { minimumOrderQuantity: "8" })]),
        quote("Y", [qi("y1", "p", 100)]),
      ],
    };
    // Tanpa izin overbuy: X harus membeli >= 8 padahal butuh 3 → tidak boleh.
    const strict = optimal(solveProcurement(makeInput({ ...base, items: [item({ productId: "p", requiredQuantity: "3" })] })));
    expect(qtyBySupplier(strict, "p")).toEqual({ Y: "3" });
    // Dengan izin overbuy 5: 8 × 20 = 160 < 3 × 100 = 300 → beli 8 dari X.
    const lenient = optimal(
      solveProcurement(makeInput({ ...base, items: [item({ productId: "p", requiredQuantity: "3", allowedOverbuyQuantity: "5" })] })),
    );
    expect(qtyBySupplier(lenient, "p")).toEqual({ X: "8" });
    expect(lenient.totalCost).toBe(160);
  });
});

describe("optimizer — acceptance test 7: split supplier dan ongkir hanya untuk supplier yang dipakai", () => {
  it("membagi satu produk ke dua supplier bila lebih murah secara total", () => {
    const r = optimal(
      solveProcurement(
        makeInput({
          items: [item({ productId: "p", requiredQuantity: "10" })],
          quotations: [
            quote("A", [qi("a1", "p", 100, { availableQuantity: "6" })], { shippingFee: 100 }),
            quote("B", [qi("b1", "p", 120)], { shippingFee: 100 }),
            quote("C", [qi("c1", "p", 90)], { shippingFee: 5_000 }), // tidak dipakai: ongkirnya terlalu mahal
          ],
        }),
      ),
    );
    expect(qtyBySupplier(r, "p")).toEqual({ A: "6", B: "4" });
    expect(r.itemsCost).toBe(6 * 100 + 4 * 120);
    expect(r.shippingCost).toBe(200); // hanya A dan B, C tidak ditagih
    expect(r.totalCost).toBe(1_280);
    expect(r.suppliers.map((s) => s.supplierId)).toEqual(["Supplier A", "Supplier B"].map((n) => n.split(" ")[1]));
  });

  it("ongkir dihitung SEKALI per supplier walau memasok beberapa produk", () => {
    const r = optimal(
      solveProcurement(
        makeInput({
          items: [item({ productId: "p1" }), item({ productId: "p2" })],
          quotations: [
            quote("A", [qi("a1", "p1", 100)], { shippingFee: 1_000 }),
            quote("B", [qi("b2", "p2", 100)], { shippingFee: 1_000 }),
            quote("C", [qi("c1", "p1", 110), qi("c2", "p2", 110)], { shippingFee: 500 }),
          ],
        }),
      ),
    );
    // C saja: 1100 + 1100 + 500 = 2700, lebih murah daripada A+B (4000) atau A+C (3600).
    expect(r.suppliers).toHaveLength(1);
    expect(r.suppliers[0].supplierId).toBe("C");
    expect(r.shippingCost).toBe(500);
    expect(r.totalCost).toBe(2_700);
  });

  it("memecah beberapa produk ke supplier berbeda bila itu paling murah", () => {
    const r = optimal(
      solveProcurement(
        makeInput({
          items: [item({ productId: "p1" }), item({ productId: "p2" })],
          quotations: [
            quote("A", [qi("a1", "p1", 10), qi("a2", "p2", 200)], { shippingFee: 100 }),
            quote("B", [qi("b1", "p1", 200), qi("b2", "p2", 10)], { shippingFee: 100 }),
          ],
        }),
      ),
    );
    expect(qtyBySupplier(r, "p1")).toEqual({ A: "10" });
    expect(qtyBySupplier(r, "p2")).toEqual({ B: "10" });
    expect(r.totalCost).toBe(100 + 100 + 100 + 100);
  });
});

describe("optimizer — acceptance test 8: harga maksimum dan budget ditegakkan oleh kode", () => {
  it("menolak penawaran di atas maximumUnitPrice walau tidak ada alternatif lain yang lebih murah", () => {
    const items = [item({ productId: "p", maximumUnitPrice: 105 })];
    const r = optimal(
      solveProcurement(makeInput({ items, quotations: [quote("A", [qi("a1", "p", 110)]), quote("B", [qi("b1", "p", 104)], { shippingFee: 900 })] })),
    );
    expect(qtyBySupplier(r, "p")).toEqual({ B: "10" });
    expect(r.ineligible).toEqual([expect.objectContaining({ supplierId: "A", reason: "PRICE_ABOVE_MAXIMUM" })]);
  });

  it("jika satu-satunya penawaran melewati harga maksimum → NO_FEASIBLE_SOLUTION", () => {
    const r = infeasible(
      solveProcurement(makeInput({ items: [item({ productId: "p", maximumUnitPrice: 100 })], quotations: [quote("A", [qi("a1", "p", 101)])] })),
    );
    expect(r.reasons[0]).toMatchObject({ code: "NO_ELIGIBLE_OFFER", productId: "p" });
  });

  const budgetCase = (restockBudget: number) =>
    solveProcurement(
      makeInput({
        restockBudget,
        items: [item({ productId: "p1" }), item({ productId: "p2" })],
        quotations: [quote("C", [qi("c1", "p1", 110), qi("c2", "p2", 110)], { shippingFee: 500 })],
      }),
    ); // total minimum = 2700

  it("total tepat sama dengan budget masih sah (batas inklusif)", () => {
    const r = optimal(budgetCase(2_700));
    expect(r.totalCost).toBe(2_700);
    expect(r.remainingBudget).toBe(0);
  });

  it("budget kurang 1 rupiah → NO_FEASIBLE_SOLUTION dengan BUDGET_EXCEEDED, tidak dilonggarkan otomatis", () => {
    const r = infeasible(budgetCase(2_699));
    expect(r.reasons).toEqual([expect.objectContaining({ code: "BUDGET_EXCEEDED", minimumTotalCost: 2_700, restockBudget: 2_699, shortfall: 1 })]);
    expect("lines" in r).toBe(false); // tidak ada pembelian yang diusulkan
  });

  it("budget berlaku level request, bukan per supplier atau per barang", () => {
    // Masing-masing supplier 1.600 ≤ 2.000, tetapi gabungan keduanya (3.200) melebihi budget request.
    const r = infeasible(
      solveProcurement(
        makeInput({
          restockBudget: 2_000,
          items: [item({ productId: "p1" }), item({ productId: "p2" })],
          quotations: [
            quote("A", [qi("a1", "p1", 150)], { shippingFee: 100 }),
            quote("B", [qi("b2", "p2", 150)], { shippingFee: 100 }),
          ],
        }),
      ),
    );
    expect(r.reasons[0]).toMatchObject({ code: "BUDGET_EXCEEDED", minimumTotalCost: 3_200 });
  });
});

describe("optimizer — acceptance test 9: tanpa solusi valid → NO_FEASIBLE_SOLUTION, tanpa order otomatis", () => {
  const items = [item({ productId: "p", productName: "Gula", requiredQuantity: "10" })];

  it("belum ada penawaran sama sekali", () => {
    const r = infeasible(solveProcurement(makeInput({ items })));
    expect(r.reasons.map((x) => x.code)).toEqual(["NO_QUOTATIONS"]);
  });

  it("stok seluruh supplier tidak cukup → INSUFFICIENT_SUPPLY dengan jumlah maksimum", () => {
    const r = infeasible(
      solveProcurement(
        makeInput({
          items,
          quotations: [quote("A", [qi("a1", "p", 100, { availableQuantity: "4" })]), quote("B", [qi("b1", "p", 100, { availableQuantity: "5" })])],
        }),
      ),
    );
    expect(r.reasons).toEqual([expect.objectContaining({ code: "INSUFFICIENT_SUPPLY", required: "10", maxCoverable: "9" })]);
    expect(r.explanationLines.join("\n")).toContain("diperlukan keputusan manual");
  });

  it.each([
    ["belum dikonfirmasi", { status: "NEEDS_CLARIFICATION" as const }, "QUOTATION_NOT_CONFIRMED"],
    ["sudah kedaluwarsa", { validUntil: new Date(NOW.getTime() - 1) }, "QUOTATION_EXPIRED"],
    ["ongkir belum jelas", { shippingFee: null }, "SHIPPING_FEE_UNKNOWN"],
    ["lead time belum jelas", { leadTimeDays: null }, "LEAD_TIME_UNKNOWN"],
  ])("penawaran %s tidak dipakai", (_name, override, reason) => {
    const r = infeasible(solveProcurement(makeInput({ items, quotations: [quote("A", [qi("a1", "p", 100)], override)] })));
    expect(r.reasons[0]).toMatchObject({ code: "NO_ELIGIBLE_OFFER" });
    expect(r.ineligible[0].reason).toBe(reason);
  });

  it("stok penawaran yang tidak dinyatakan tidak diasumsikan tersedia", () => {
    const r = infeasible(solveProcurement(makeInput({ items, quotations: [quote("A", [qi("a1", "p", 100, { availableQuantity: null })])] })));
    expect(r.ineligible[0].reason).toBe("AVAILABLE_QUANTITY_UNKNOWN");
  });

  it("masa berlaku tepat habis pada detik ini dianggap kedaluwarsa; kosong dianggap tanpa batas", () => {
    const expired = solveProcurement(makeInput({ items, quotations: [quote("A", [qi("a1", "p", 100)], { validUntil: NOW })] }));
    expect(expired.status).toBe("NO_FEASIBLE_SOLUTION");
    const open = solveProcurement(makeInput({ items, quotations: [quote("A", [qi("a1", "p", 100)], { validUntil: new Date(NOW.getTime() + 1) })] }));
    expect(open.status).toBe("OPTIMAL");
  });
});

describe("optimizer — kemasan, desimal, determinisme", () => {
  it("kelipatan kemasan tanpa izin overbuy tidak bisa memenuhi kebutuhan → COVERAGE_IMPOSSIBLE (bukan 'stok kurang')", () => {
    const r = infeasible(
      solveProcurement(
        makeInput({
          items: [item({ productId: "p", requiredQuantity: "28" })],
          quotations: [quote("A", [qi("a1", "p", 39, { packSize: "12", minimumOrderQuantity: "12", availableQuantity: "120" })])],
        }),
      ),
    );
    expect(r.reasons).toEqual([expect.objectContaining({ code: "COVERAGE_IMPOSSIBLE" })]);
    expect(r.reasons[0].message).toContain("stok cukup");
  });

  it("dengan izin overbuy, membeli kelipatan kemasan (3 dus = 36)", () => {
    const r = optimal(
      solveProcurement(
        makeInput({
          items: [item({ productId: "p", requiredQuantity: "28", allowedOverbuyQuantity: "8" })],
          quotations: [quote("A", [qi("a1", "p", 39, { packSize: "12", minimumOrderQuantity: "12", availableQuantity: "120" })])],
        }),
      ),
    );
    expect(qtyBySupplier(r, "p")).toEqual({ A: "36" });
    expect(r.totalCost).toBe(36 * 39);
    expect(r.explanationLines.join("\n")).toContain("dibeli 36");
  });

  it("memilih eceran 28 unit daripada 3 dus (36) bila total lebih murah", () => {
    const r = optimal(
      solveProcurement(
        makeInput({
          items: [item({ productId: "p", requiredQuantity: "28", allowedOverbuyQuantity: "8" })],
          quotations: [
            quote("A", [qi("a1", "p", 39, { packSize: "12", minimumOrderQuantity: "12", availableQuantity: "120" })], { shippingFee: 25 }),
            quote("B", [qi("b1", "p", 37)], { shippingFee: 15 }),
          ],
        }),
      ),
    );
    expect(qtyBySupplier(r, "p")).toEqual({ B: "28" });
    expect(r.totalCost).toBe(28 * 37 + 15);
  });

  it("kuantitas desimal sesuai presisi satuan", () => {
    const r = optimal(
      solveProcurement(
        makeInput({
          items: [item({ productId: "p", quantityScale: 1, requiredQuantity: "2.5" })],
          quotations: [quote("A", [qi("a1", "p", 10_000, { availableQuantity: "10", minimumOrderQuantity: "0.5" })])],
        }),
      ),
    );
    expect(qtyBySupplier(r, "p")).toEqual({ A: "2.5" });
    expect(r.totalCost).toBe(25_000);
  });

  it("biaya baris dibulatkan ke atas ke rupiah utuh", () => {
    const r = optimal(
      solveProcurement(
        makeInput({
          items: [item({ productId: "p", quantityScale: 1, requiredQuantity: "2.5" })],
          quotations: [quote("A", [qi("a1", "p", 12_345)])],
        }),
      ),
    );
    expect(r.totalCost).toBe(30_863); // ceil(12345 × 2.5 = 30862.5)
    expect(Number.isInteger(r.totalCost)).toBe(true);
  });

  it("deterministik: urutan masukan tidak memengaruhi hasil", () => {
    const quotations = [
      quote("A", [qi("a1", "p1", 100), qi("a2", "p2", 120)], { shippingFee: 300 }),
      quote("B", [qi("b1", "p1", 95), qi("b2", "p2", 125)], { shippingFee: 400 }),
      quote("C", [qi("c1", "p1", 105), qi("c2", "p2", 100)], { shippingFee: 200 }),
    ];
    const items = [item({ productId: "p1" }), item({ productId: "p2" })];
    const a = optimal(solveProcurement(makeInput({ items, quotations })));
    const b = optimal(solveProcurement(makeInput({ items: [...items].reverse(), quotations: [...quotations].reverse() })));
    expect(b.totalCost).toBe(a.totalCost);
    expect(b.lines.map((l) => [l.quotationItemId, l.quantity]).sort()).toEqual(a.lines.map((l) => [l.quotationItemId, l.quantity]).sort());
  });

  it("produk di luar kebutuhan request diabaikan; dua penawaran satu supplier ditolak sebagai galat masukan", () => {
    const ok = optimal(
      solveProcurement(makeInput({ items: [item({ productId: "p" })], quotations: [quote("A", [qi("a1", "p", 100), qi("a9", "lain", 1)])] })),
    );
    expect(ok.lines).toHaveLength(1);

    const dup = solveProcurement(
      makeInput({
        items: [item({ productId: "p" })],
        quotations: [quote("A", [qi("a1", "p", 100)]), quote("A", [qi("a2", "p", 90)], { quotationId: "q-A2" })],
      }),
    );
    expect(dup.status).toBe("ERROR");
  });

  it("penjelasan memuat total, sisa budget, dan alasan supplier termurah tidak dipakai", () => {
    const r = optimal(
      solveProcurement(
        makeInput({
          restockBudget: 5_000,
          items: [item({ productId: "p", productName: "Telur" })],
          quotations: [
            quote("A", [qi("a1", "p", 80, { availableQuantity: "4" })], { shippingFee: 50 }),
            quote("B", [qi("b1", "p", 100)], { shippingFee: 50 }),
          ],
        }),
      ),
    );
    const text = r.explanationLines.join("\n");
    expect(text).toContain("Sisa Restock Budget");
    expect(text).toContain("dihitung sekali");
    expect(r.remainingBudget).toBe(5_000 - r.totalCost);
  });

  it("masukan tidak sah → ERROR, bukan tebakan", () => {
    expect(solveProcurement(makeInput({ items: [] })).status).toBe("ERROR");
    expect(solveProcurement(makeInput({ restockBudget: 0, items: [item({ productId: "p" })] })).status).toBe("ERROR");
  });
});

describe("validator independen (§4.3)", () => {
  const input = makeInput({
    restockBudget: 5_000,
    items: [item({ productId: "p", productName: "Gula", requiredQuantity: "10", allowedOverbuyQuantity: "2", maximumUnitPrice: 120 })],
    quotations: [
      quote("A", [qi("a1", "p", 100, { availableQuantity: "20", minimumOrderQuantity: "4", packSize: "2" })], { shippingFee: 200 }),
      quote("E", [qi("e1", "p", 90)], { validUntil: new Date(NOW.getTime() - 1000) }),
      quote("H", [qi("h1", "p", 130)]),
    ],
  });
  const codes = (lines: { quotationItemId: string; quantity: string }[]) => validateSolution(input, lines).violations.map((v) => v.code);

  it("menerima solusi valid dan menghitung total", () => {
    const v = validateSolution(input, [{ quotationItemId: "a1", quantity: "10" }]);
    expect(v.ok).toBe(true);
    expect(v.totals?.totalCost).toBe(10 * 100 + 200);
  });

  it("menolak kebutuhan tidak terpenuhi, overbuy melebihi izin, di bawah MOQ, bukan kelipatan kemasan, melebihi stok", () => {
    expect(codes([{ quotationItemId: "a1", quantity: "8" }])).toContain("REQUIREMENT_NOT_MET");
    expect(codes([{ quotationItemId: "a1", quantity: "14" }])).toContain("OVERBUY_EXCEEDED");
    expect(codes([{ quotationItemId: "a1", quantity: "2" }])).toContain("BELOW_MOQ");
    expect(codes([{ quotationItemId: "a1", quantity: "11" }])).toContain("NOT_PACK_MULTIPLE");
    expect(codes([{ quotationItemId: "a1", quantity: "24" }])).toContain("EXCEEDS_AVAILABLE");
  });

  it("menolak penawaran kedaluwarsa, harga di atas maksimum, dan baris tak dikenal", () => {
    expect(codes([{ quotationItemId: "e1", quantity: "10" }])).toContain("QUOTATION_EXPIRED");
    expect(codes([{ quotationItemId: "h1", quantity: "10" }])).toContain("PRICE_ABOVE_MAXIMUM");
    expect(codes([{ quotationItemId: "hantu", quantity: "10" }])).toContain("UNKNOWN_OFFER");
  });

  it("menolak total di atas budget dan baris ganda", () => {
    const tight = { ...input, restockBudget: 1_199 };
    expect(validateSolution(tight, [{ quotationItemId: "a1", quantity: "10" }]).violations.map((v) => v.code)).toContain("BUDGET_EXCEEDED");
    expect(codes([{ quotationItemId: "a1", quantity: "6" }, { quotationItemId: "a1", quantity: "4" }])).toContain("DUPLICATE_LINE");
  });

  it("menolak kuantitas melebihi presisi satuan", () => {
    expect(codes([{ quotationItemId: "a1", quantity: "10.5" }])).toContain("SCALE_EXCEEDED");
  });
});
