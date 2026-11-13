import type { LpModel } from "javascript-lp-solver";
import type { EligibleOffer } from "./eligibility";

export interface ModelNames {
  n: (offerIndex: number) => string;
  z: (offerIndex: number) => string;
}

export const names: ModelNames = { n: (i) => `n${i}`, z: (i) => `z${i}` };

/**
 * Model MILP (SUPPLIO.md §4.2). Untuk setiap penawaran layak `i` milik supplier `s` dan produk `p`:
 *   n_i  integer  jumlah LANGKAH beli (langkah = packSize, atau 10^-scale bila tanpa kemasan)
 *   z_i  biner    1 bila penawaran i dipakai → memberlakukan MOQ (n_i >= nMin) dan batas stok (n_i <= nMax)
 *   y_s  biner    1 bila supplier s dipakai → ongkir dibayar SEKALI (z_i <= y_s)
 *
 *   min  Σ costPerStep_i·n_i + Σ shipping_s·y_s
 *   s.t. required_p <= Σ step_i·n_i <= required_p + allowedOverbuy_p     (kebutuhan & batas overbuy)
 *        Σ costPerStep_i·n_i + Σ shipping_s·y_s <= restockBudget          (budget level request)
 *        nMin_i·z_i <= n_i <= nMax_i·z_i ;  z_i <= y_s
 *
 * Harga satuan maksimum, masa berlaku, lead time, stok, dan kemasan sudah ditegakkan saat penyaringan
 * (eligibility) dan dicek ulang oleh validator independen. `budget = null` dipakai hanya untuk diagnosis.
 */
export function buildModel(
  offers: EligibleOffer[],
  requiredMilli: Map<string, number>,
  overbuyMilli: Map<string, number>,
  budget: number | null,
): LpModel {
  const productIds = [...requiredMilli.keys()].sort();
  const productIdx = new Map(productIds.map((id, k) => [id, k]));
  const supplierIds = [...new Set(offers.map((o) => o.supplierId))].sort();
  const supplierIdx = new Map(supplierIds.map((id, k) => [id, k]));

  const constraints: LpModel["constraints"] = {};
  const variables: LpModel["variables"] = {};
  const ints: Record<string, 1> = {};
  const binaries: Record<string, 1> = {};

  for (const id of productIds) {
    const k = productIdx.get(id)!;
    const required = requiredMilli.get(id)!;
    constraints[`cover${k}`] = { min: required, max: required + (overbuyMilli.get(id) ?? 0) };
  }
  if (budget !== null) constraints.budget = { max: budget };

  for (const s of supplierIds) {
    const k = supplierIdx.get(s)!;
    const shipping = offers.find((o) => o.supplierId === s)!.shippingFee;
    variables[`y${k}`] = { cost: shipping };
    if (budget !== null) variables[`y${k}`].budget = shipping;
    binaries[`y${k}`] = 1;
  }

  for (const o of offers) {
    const p = productIdx.get(o.productId)!;
    const s = supplierIdx.get(o.supplierId)!;
    constraints[`ub${o.index}`] = { max: 0 };
    constraints[`lb${o.index}`] = { min: 0 };
    constraints[`lk${o.index}`] = { max: 0 };

    variables[names.n(o.index)] = {
      cost: o.costPerStep,
      [`cover${p}`]: o.stepMilli,
      [`ub${o.index}`]: 1,
      [`lb${o.index}`]: 1,
      ...(budget !== null ? { budget: o.costPerStep } : {}),
    };
    variables[names.z(o.index)] = {
      cost: 0,
      [`ub${o.index}`]: -o.nMax,
      [`lb${o.index}`]: -o.nMin,
      [`lk${o.index}`]: 1,
    };
    variables[`y${s}`][`lk${o.index}`] = -1;

    ints[names.n(o.index)] = 1;
    binaries[names.z(o.index)] = 1;
  }

  return { optimize: "cost", opType: "min", constraints, variables, ints, binaries };
}
