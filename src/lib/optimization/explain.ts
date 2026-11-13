import Decimal from "decimal.js";
import { formatQty, formatRupiah } from "@/lib/format";
import type { EligibleOffer, OfferSet } from "./eligibility";
import { MILLI } from "./eligibility";
import type { IneligibleOffer, InfeasibilityReason, OptimizerInput, RejectionReason, Totals } from "./types";

const REASON_LABEL: Record<RejectionReason, string> = {
  QUOTATION_NOT_CONFIRMED: "penawaran belum dikonfirmasi",
  QUOTATION_EXPIRED: "penawaran sudah kedaluwarsa",
  SHIPPING_FEE_UNKNOWN: "ongkir belum jelas",
  LEAD_TIME_UNKNOWN: "lead time belum jelas",
  LEAD_TIME_TOO_LONG: "lead time melewati batas kedatangan",
  PRICE_ABOVE_MAXIMUM: "harga di atas harga maksimum",
  AVAILABLE_QUANTITY_UNKNOWN: "stok belum dinyatakan",
  OUT_OF_STOCK: "stok habis",
  MOQ_OR_PACK_EXCEEDS_LIMIT: "MOQ/kemasan melebihi jumlah yang boleh dibeli",
  INVALID_DATA: "data tidak valid",
};

export const describeRejection = (r: IneligibleOffer): string =>
  `${r.supplierName}: ${REASON_LABEL[r.reason]} (${r.detail})`;

function ineligibleLines(ineligible: IneligibleOffer[], input: OptimizerInput): string[] {
  if (ineligible.length === 0) return [];
  const name = new Map(input.items.map((i) => [i.productId, i.productName]));
  return [
    "Penawaran yang tidak dipakai:",
    ...ineligible.map((r) => `- ${name.get(r.productId) ?? r.productId} · ${describeRejection(r)}`),
  ];
}

/** Penjelasan deterministik dari angka yang sudah divalidasi; tidak melibatkan LLM. */
export function explainOptimal(
  input: OptimizerInput,
  set: OfferSet,
  totals: Totals,
  remainingBudget: number,
): string[] {
  const lines: string[] = [
    `Total ${formatRupiah(totals.totalCost)} = barang ${formatRupiah(totals.itemsCost)} + ongkir ${formatRupiah(
      totals.shippingCost,
    )} dari ${totals.suppliers.length} supplier. Sisa Restock Budget ${formatRupiah(remainingBudget)} dari ${formatRupiah(
      input.restockBudget,
    )}.`,
  ];

  for (const s of totals.suppliers) {
    const items = totals.lines
      .filter((l) => l.supplierId === s.supplierId)
      .map((l) => `${l.productName} ${formatQty(l.quantity)} ${l.unit} × ${formatRupiah(l.unitPrice)} = ${formatRupiah(l.lineCost)}`);
    lines.push(
      `${s.supplierName}: ongkir ${formatRupiah(s.shippingFee)} (dihitung sekali), lead time ${s.leadTimeDays} hari. ${items.join("; ")}.`,
    );
  }

  for (const item of input.items) {
    const bought = totals.lines.filter((l) => l.productId === item.productId);
    const total = bought.reduce((sum, l) => sum.plus(l.quantity), new Decimal(0));
    const offers = set.offers.filter((o) => o.productId === item.productId);
    const cheapest = Math.min(...offers.map((o) => o.unitPrice));
    const usedSuppliers = new Set(bought.map((l) => l.supplierId));

    const notes: string[] = [];
    if (bought.every((l) => l.unitPrice === cheapest)) {
      notes.push(`memakai harga satuan terendah yang valid (${formatRupiah(cheapest)})`);
    }
    for (const o of offers.filter((o) => o.unitPrice < Math.max(...bought.map((l) => l.unitPrice)) && !usedSuppliers.has(o.supplierId))) {
      notes.push(unusedReason(o, set.requiredMilli.get(item.productId)!));
    }
    if (bought.length > 1) {
      notes.push("pembelian dibagi ke beberapa supplier karena satu supplier tidak mencukupi atau kombinasi ini paling murah secara total");
    }
    if (total.gt(item.requiredQuantity)) {
      notes.push(
        `dibeli ${formatQty(total.toString())} (kebutuhan ${formatQty(item.requiredQuantity)}) akibat kelipatan kemasan/MOQ, masih dalam batas kelebihan beli ${formatQty(item.allowedOverbuyQuantity)}`,
      );
    }
    lines.push(`${item.productName}: ${notes.join("; ")}.`);
  }

  return [...lines, ...ineligibleLines(set.ineligible, input)];
}

/** Alasan yang TERVERIFIKASI mengapa penawaran berharga lebih murah tidak dipakai. */
function unusedReason(o: EligibleOffer, requiredMilli: number): string {
  if (o.nMax * o.stepMilli < requiredMilli) {
    return `${o.supplierName} lebih murah (${formatRupiah(o.unitPrice)}) tetapi stoknya hanya ${formatQty(
      String((o.nMax * o.stepMilli) / MILLI),
    )} sehingga tidak bisa memenuhi sendiri`;
  }
  return `${o.supplierName} lebih murah per satuan (${formatRupiah(o.unitPrice)}) tetapi tidak dipakai karena kombinasi lain lebih murah secara total (ongkir, MOQ, kelipatan kemasan)`;
}

export function explainInfeasible(
  input: OptimizerInput,
  reasons: InfeasibilityReason[],
  ineligible: IneligibleOffer[],
): string[] {
  return [
    "Tidak ada kombinasi pembelian yang memenuhi semua batasan. Tidak ada pembelian otomatis; diperlukan keputusan manual.",
    ...reasons.map((r) => `- ${r.message}`),
    ...ineligibleLines(ineligible, input),
  ];
}
