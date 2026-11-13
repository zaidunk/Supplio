import Decimal from "decimal.js";
import solver from "javascript-lp-solver";
import { formatQty, formatRupiah } from "@/lib/format";
import { MILLI, buildOffers, type OfferSet } from "./eligibility";
import { describeRejection, explainInfeasible, explainOptimal } from "./explain";
import { buildModel, names } from "./model";
import type { InfeasibilityReason, OptimizerInput, OptimizerResult, ProposedLine } from "./types";
import { validateSolution } from "./validate";

/**
 * Procurement Optimizer (SUPPLIO.md §4.2): total biaya (barang + ongkir) terendah yang memenuhi kebutuhan,
 * Restock Budget, harga maksimum, stok, MOQ, kelipatan kemasan, masa berlaku, dan batas kedatangan.
 *
 * Aturan keselamatan:
 *  - Hasil solver TIDAK dipercaya: selalu dihitung ulang dan dicek `validateSolution`; bila ada pelanggaran
 *    hasilnya `ERROR`, tidak pernah dikembalikan sebagai rekomendasi.
 *  - Tidak feasible → `NO_FEASIBLE_SOLUTION` + penyebab. Budget/batasan tidak pernah dilonggarkan otomatis.
 *  - LLM tidak dilibatkan sama sekali.
 *
 * Catatan skala: B&B jsLPSolver cukup untuk beberapa barang × beberapa supplier (target MVP), bukan ratusan.
 */
export function solveProcurement(input: OptimizerInput): OptimizerResult {
  if (input.items.length === 0) return { status: "ERROR", message: "Request tidak memiliki barang." };
  if (!Number.isInteger(input.restockBudget) || input.restockBudget <= 0) {
    return { status: "ERROR", message: "Restock Budget harus bilangan bulat rupiah > 0." };
  }

  let set: OfferSet;
  try {
    set = buildOffers(input);
  } catch (e) {
    return { status: "ERROR", message: e instanceof Error ? e.message : "Masukan optimizer tidak valid." };
  }

  const everyProductHasOffer = input.items.every((i) => set.offers.some((o) => o.productId === i.productId));
  if (everyProductHasOffer) {
    const sol = solver.Solve(buildModel(set.offers, set.requiredMilli, set.overbuyMilli, input.restockBudget));
    if (sol.feasible) return finalize(input, set, extractLines(set, sol));
  }

  const reasons = diagnose(input, set);
  return {
    status: "NO_FEASIBLE_SOLUTION",
    reasons,
    explanationLines: explainInfeasible(input, reasons, set.ineligible),
    ineligible: set.ineligible,
  };
}

type Solution = ReturnType<typeof solver.Solve>;

function extractLines(set: OfferSet, sol: Solution): ProposedLine[] | null {
  const lines: ProposedLine[] = [];
  for (const o of set.offers) {
    const raw = Number(sol[names.n(o.index)] ?? 0);
    const n = Math.round(raw);
    if (Math.abs(raw - n) > 1e-6) return null; // tidak integral → jangan dipercaya
    if (n > 0) {
      lines.push({ quotationItemId: o.quotationItemId, quantity: new Decimal(n * o.stepMilli).div(MILLI).toString() });
    }
  }
  return lines;
}

function finalize(input: OptimizerInput, set: OfferSet, lines: ProposedLine[] | null): OptimizerResult {
  if (lines === null) return { status: "ERROR", message: "Solver mengembalikan solusi yang tidak integral." };

  const check = validateSolution(input, lines);
  if (!check.ok || !check.totals) {
    return { status: "ERROR", message: "Solusi solver gagal validasi independen dan dibuang.", violations: check.violations };
  }
  const remainingBudget = input.restockBudget - check.totals.totalCost;
  return {
    status: "OPTIMAL",
    ...check.totals,
    remainingBudget,
    explanationLines: explainOptimal(input, set, check.totals, remainingBudget),
    ineligible: set.ineligible,
  };
}

/** Penyebab tidak feasible yang dapat diverifikasi; urutan: data → stok → kombinasi → budget. */
function diagnose(input: OptimizerInput, set: OfferSet): InfeasibilityReason[] {
  const reasons: InfeasibilityReason[] = [];

  if (input.quotations.length === 0) {
    reasons.push({ code: "NO_QUOTATIONS", message: "Belum ada penawaran supplier yang dikonfirmasi." });
  }

  for (const item of input.items) {
    const offers = set.offers.filter((o) => o.productId === item.productId);
    if (offers.length === 0) {
      if (input.quotations.length === 0) continue;
      const why = set.ineligible.filter((r) => r.productId === item.productId).map(describeRejection);
      reasons.push({
        code: "NO_ELIGIBLE_OFFER",
        productId: item.productId,
        productName: item.productName,
        message: `${item.productName}: tidak ada penawaran yang layak. ${why.length > 0 ? why.join("; ") + "." : "Tidak ada supplier yang menawarkan produk ini."}`,
      });
      continue;
    }
    const required = set.requiredMilli.get(item.productId)!;
    const byStock = offers.reduce((sum, o) => sum + o.nMaxByStock * o.stepMilli, 0);
    const withinLimit = offers.reduce((sum, o) => sum + o.nMax * o.stepMilli, 0);
    if (byStock < required) {
      const maxCoverable = new Decimal(byStock).div(MILLI).toString();
      reasons.push({
        code: "INSUFFICIENT_SUPPLY",
        productId: item.productId,
        productName: item.productName,
        required: item.requiredQuantity,
        maxCoverable,
        message: `${item.productName}: total stok seluruh penawaran layak hanya ${formatQty(maxCoverable)} ${item.unit}, dibutuhkan ${formatQty(
          item.requiredQuantity,
        )} ${item.unit}. Perlu supplier tambahan atau kurangi kebutuhan.`,
      });
    } else if (withinLimit < required) {
      // Stok ada, tetapi kelipatan kemasan/MOQ + batas kelebihan beli tidak mengizinkan membeli sebanyak itu.
      reasons.push({
        code: "COVERAGE_IMPOSSIBLE",
        message: `${item.productName}: stok cukup, tetapi kelipatan kemasan/MOQ dan batas kelebihan beli (${formatQty(
          item.allowedOverbuyQuantity,
        )} ${item.unit}) hanya mengizinkan pembelian sampai ${formatQty(
          new Decimal(withinLimit).div(MILLI).toString(),
        )} ${item.unit}, dibutuhkan ${formatQty(item.requiredQuantity)} ${item.unit}. Izinkan kelebihan beli untuk produk ini atau minta penawaran lain.`,
      });
    }
  }
  if (reasons.length > 0) return reasons;

  // Semua produk punya penawaran dan stok cukup: tanya solver tanpa budget untuk membedakan penyebabnya.
  const relaxed = solver.Solve(buildModel(set.offers, set.requiredMilli, set.overbuyMilli, null));
  if (!relaxed.feasible) {
    return [
      {
        code: "COVERAGE_IMPOSSIBLE",
        message:
          "Kombinasi MOQ, kelipatan kemasan, dan batas kelebihan beli tidak memungkinkan kebutuhan terpenuhi persis. " +
          "Pertimbangkan mengizinkan kelebihan beli untuk produk terkait atau meminta penawaran lain.",
      },
    ];
  }
  const minimumTotalCost = Math.round(relaxed.result);
  const shortfall = Math.max(1, minimumTotalCost - input.restockBudget);
  return [
    {
      code: "BUDGET_EXCEEDED",
      minimumTotalCost,
      restockBudget: input.restockBudget,
      shortfall,
      message: `Total terendah yang memenuhi kebutuhan adalah ${formatRupiah(minimumTotalCost)}, melebihi Restock Budget ${formatRupiah(
        input.restockBudget,
      )} (kurang ${formatRupiah(shortfall)}). Budget tidak dilampaui otomatis; naikkan budget atau kurangi kebutuhan secara manual.`,
    },
  ];
}
