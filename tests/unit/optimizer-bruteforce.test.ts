import { describe, expect, it } from "vitest";
import { solveProcurement } from "@/lib/optimization/solve";
import type { OptimizerInput } from "@/lib/optimization/types";
import { validateSolution } from "@/lib/optimization/validate";
import { item, makeInput, qi, quote } from "./optimizer-fixtures";

/** PRNG deterministik (mulberry32) agar kegagalan selalu bisa direproduksi dari seed-nya. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInstance(seed: number): OptimizerInput {
  const r = rng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const pick = <T,>(xs: T[]) => xs[int(0, xs.length - 1)];

  const productCount = int(1, 2);
  const supplierCount = int(2, 3);
  const items = Array.from({ length: productCount }, (_, k) =>
    item({ productId: `p${k}`, requiredQuantity: String(int(2, 5)), allowedOverbuyQuantity: String(pick([0, 0, 1, 2])) }),
  );
  const quotations = Array.from({ length: supplierCount }, (_, s) => {
    const qItems = items
      .filter(() => r() < 0.9)
      .map((it) =>
        qi(`s${s}-${it.productId}`, it.productId, int(5, 30) * 100, {
          availableQuantity: String(int(3, 8)),
          minimumOrderQuantity: String(pick([1, 1, 2, 3])),
          packSize: pick([null, null, null, "2"]),
        }),
      );
    return quote(`s${s}`, qItems, { shippingFee: int(0, 15) * 100 });
  });
  // Budget dari ketat sampai longgar agar kedua cabang (feasible/infeasible) sama-sama teruji.
  return makeInput({ restockBudget: int(30, 140) * 100, items, quotations });
}

/**
 * Pencari optimum eksak (enumerasi) yang ditulis TERPISAH dari kode optimizer: memeriksa kembali aturan MOQ,
 * kelipatan kemasan, stok, batas overbuy, budget, dan ongkir-sekali-per-supplier dari data mentah.
 */
function bruteForce(input: OptimizerInput): number | null {
  const offers = input.quotations.flatMap((q) =>
    q.items.map((i) => ({
      supplier: q.supplierId,
      ship: q.shippingFee!,
      product: i.productId,
      price: i.quotedUnitPrice,
      moq: Number(i.minimumOrderQuantity),
      pack: i.packSize === null ? 1 : Number(i.packSize),
      avail: Number(i.availableQuantity),
    })),
  );
  const required = new Map(input.items.map((i) => [i.productId, Number(i.requiredQuantity)]));
  const ceiling = new Map(input.items.map((i) => [i.productId, Number(i.requiredQuantity) + Number(i.allowedOverbuyQuantity)]));

  let best: number | null = null;
  const bought = new Map<string, number>();
  const usedSuppliers = new Map<string, { ship: number; n: number }>();

  const recurse = (idx: number, itemsCost: number) => {
    if (idx === offers.length) {
      for (const [p, need] of required) if ((bought.get(p) ?? 0) < need) return;
      const ship = [...usedSuppliers.values()].reduce((s, u) => s + (u.n > 0 ? u.ship : 0), 0);
      const total = itemsCost + ship;
      if (total <= input.restockBudget && (best === null || total < best)) best = total;
      return;
    }
    const o = offers[idx];
    const cap = Math.min(o.avail, ceiling.get(o.product) ?? 0);
    for (let q = 0; q <= cap; q++) {
      if (q > 0 && (q < o.moq || q % o.pack !== 0)) continue;
      if ((bought.get(o.product) ?? 0) + q > (ceiling.get(o.product) ?? 0)) break;
      bought.set(o.product, (bought.get(o.product) ?? 0) + q);
      const u = usedSuppliers.get(o.supplier) ?? { ship: o.ship, n: 0 };
      usedSuppliers.set(o.supplier, { ship: o.ship, n: u.n + (q > 0 ? 1 : 0) });
      recurse(idx + 1, itemsCost + q * o.price);
      usedSuppliers.set(o.supplier, u);
      bought.set(o.product, (bought.get(o.product) ?? 0) - q);
    }
  };
  recurse(0, 0);
  return best;
}

describe("optimizer vs brute force (uji properti, seed tetap)", () => {
  const SEEDS = Array.from({ length: 150 }, (_, i) => 1000 + i);
  let optimalCount = 0;
  let infeasibleCount = 0;

  it.each(SEEDS)("seed %i: biaya minimum dan kelayakan identik dengan enumerasi eksak", (seed) => {
    const input = randomInstance(seed);
    const expected = bruteForce(input);
    const result = solveProcurement(input);

    expect(result.status, `seed ${seed} → ${JSON.stringify(result).slice(0, 300)}`).not.toBe("ERROR");
    if (expected === null) {
      infeasibleCount++;
      expect(result.status, `seed ${seed}: brute force tidak menemukan solusi`).toBe("NO_FEASIBLE_SOLUTION");
    } else {
      optimalCount++;
      expect(result.status, `seed ${seed}: brute force menemukan ${expected}`).toBe("OPTIMAL");
      if (result.status === "OPTIMAL") {
        expect(result.totalCost, `seed ${seed}`).toBe(expected);
        // Hasil optimizer juga lolos validator independen.
        expect(validateSolution(input, result.lines.map((l) => ({ quotationItemId: l.quotationItemId, quantity: l.quantity }))).ok).toBe(true);
      }
    }
  });

  it("rangkaian seed mencakup kasus feasible maupun infeasible (bukan uji yang tidak bermakna)", () => {
    expect(optimalCount).toBeGreaterThan(30);
    expect(infeasibleCount).toBeGreaterThan(10);
  });
});
