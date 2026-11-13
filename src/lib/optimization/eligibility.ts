import Decimal from "decimal.js";
import type { IneligibleOffer, OptimizerInput, OptimizerQuotation, OptimizerRequestItem, RejectionReason } from "./types";

/** Kuantitas dikerjakan sebagai bilangan bulat "milli-unit" (1 unit = 1000) agar solver tidak bergulat dengan pecahan. */
export const MILLI = 1000;

export interface EligibleOffer {
  /** Indeks stabil dipakai untuk menamai variabel model. */
  index: number;
  quotationId: string;
  supplierId: string;
  supplierName: string;
  quotationItemId: string;
  productId: string;
  unitPrice: number;
  /** Langkah pembelian terkecil (milli-unit): packSize bila ada, selain itu 10^-quantityScale. */
  stepMilli: number;
  /** Jumlah langkah minimum bila supplier dipakai (MOQ dibulatkan ke atas ke kelipatan langkah). */
  nMin: number;
  /** Jumlah langkah maksimum: min(stok penawaran, kebutuhan + kelebihan beli yang diizinkan). */
  nMax: number;
  /** Langkah yang mungkin dibeli bila HANYA dibatasi stok penawaran (untuk membedakan penyebab infeasible). */
  nMaxByStock: number;
  /** ceil(harga × langkah) per langkah; batas atas biaya sebenarnya sehingga budget tidak pernah terlampaui. */
  costPerStep: number;
  shippingFee: number;
  leadTimeDays: number;
}

export interface OfferSet {
  offers: EligibleOffer[];
  ineligible: IneligibleOffer[];
  requiredMilli: Map<string, number>;
  overbuyMilli: Map<string, number>;
}

class InvalidData extends Error {}

/** Desimal → milli-unit bulat; tolak bila lebih dari 3 desimal atau tidak berhingga. */
export function toMilli(value: string): number {
  const d = new Decimal(value).times(MILLI);
  if (!d.isFinite() || !d.isInteger()) throw new InvalidData(`kuantitas "${value}" tidak valid`);
  return d.toNumber();
}

const stepFor = (item: OptimizerRequestItem, packSize: string | null): number => {
  if (packSize !== null) return toMilli(packSize);
  return Math.round(MILLI / 10 ** item.quantityScale);
};

/**
 * Menentukan penawaran mana yang boleh masuk solver (aturan §4.2 butir 3-7) beserta alasan penolakannya.
 * Tidak ada data yang diasumsikan: stok, ongkir, atau lead time yang tidak jelas → ditolak, bukan ditebak.
 */
export function buildOffers(input: OptimizerInput): OfferSet {
  const itemsByProduct = new Map(input.items.map((i) => [i.productId, i]));
  const requiredMilli = new Map<string, number>();
  const overbuyMilli = new Map<string, number>();
  for (const item of input.items) {
    requiredMilli.set(item.productId, toMilli(item.requiredQuantity));
    overbuyMilli.set(item.productId, toMilli(item.allowedOverbuyQuantity));
  }

  const supplierSeen = new Set<string>();
  const ordered = [...input.quotations].sort((a, b) => a.supplierId.localeCompare(b.supplierId));
  const offers: EligibleOffer[] = [];
  const ineligible: IneligibleOffer[] = [];

  for (const q of ordered) {
    if (supplierSeen.has(q.supplierId)) {
      throw new Error(`Supplier ${q.supplierId} memiliki lebih dari satu penawaran; gunakan penawaran final terbaru saja.`);
    }
    supplierSeen.add(q.supplierId);

    const quotationReason = quotationLevelRejection(q, input.now);
    const items = [...q.items].sort((a, b) => a.productId.localeCompare(b.productId));
    const seenProducts = new Set<string>();

    for (const qi of items) {
      const item = itemsByProduct.get(qi.productId);
      if (!item) continue; // produk di luar kebutuhan request diabaikan
      if (seenProducts.has(qi.productId)) {
        reject(ineligible, q, qi.productId, "INVALID_DATA", "produk muncul dua kali dalam satu penawaran");
        continue;
      }
      seenProducts.add(qi.productId);

      if (quotationReason) {
        reject(ineligible, q, qi.productId, quotationReason.reason, quotationReason.detail);
        continue;
      }
      const verdict = evaluateOffer(q, qi, item, requiredMilli.get(qi.productId)!, overbuyMilli.get(qi.productId)!);
      if ("reason" in verdict) {
        reject(ineligible, q, qi.productId, verdict.reason, verdict.detail);
        continue;
      }
      offers.push({
        index: offers.length,
        quotationId: q.quotationId,
        supplierId: q.supplierId,
        supplierName: q.supplierName,
        quotationItemId: qi.quotationItemId,
        productId: qi.productId,
        shippingFee: q.shippingFee!,
        leadTimeDays: q.leadTimeDays!,
        ...verdict,
      });
    }
  }
  return { offers, ineligible, requiredMilli, overbuyMilli };
}

function quotationLevelRejection(q: OptimizerQuotation, now: Date): { reason: RejectionReason; detail: string } | null {
  if (q.status !== "CONFIRMED") return { reason: "QUOTATION_NOT_CONFIRMED", detail: `status penawaran ${q.status}` };
  // validUntil kosong = supplier tidak menyebut batas waktu; tidak ada alasan menolaknya.
  if (q.validUntil !== null && q.validUntil.getTime() <= now.getTime()) {
    return { reason: "QUOTATION_EXPIRED", detail: `berlaku sampai ${q.validUntil.toISOString()}` };
  }
  if (q.shippingFee === null) return { reason: "SHIPPING_FEE_UNKNOWN", detail: "ongkir belum dikonfirmasi" };
  if (q.leadTimeDays === null) return { reason: "LEAD_TIME_UNKNOWN", detail: "lead time belum dikonfirmasi" };
  if (!Number.isInteger(q.shippingFee) || q.shippingFee < 0) return { reason: "INVALID_DATA", detail: "ongkir tidak valid" };
  if (!Number.isInteger(q.leadTimeDays) || q.leadTimeDays < 0) return { reason: "INVALID_DATA", detail: "lead time tidak valid" };
  return null;
}

type Verdict =
  | { reason: RejectionReason; detail: string }
  | Pick<EligibleOffer, "unitPrice" | "stepMilli" | "nMin" | "nMax" | "nMaxByStock" | "costPerStep">;

function evaluateOffer(
  q: OptimizerQuotation,
  qi: OptimizerQuotation["items"][number],
  item: OptimizerRequestItem,
  requiredMilli: number,
  overbuyMilli: number,
): Verdict {
  if (!Number.isInteger(qi.quotedUnitPrice) || qi.quotedUnitPrice <= 0) {
    return { reason: "INVALID_DATA", detail: "harga satuan tidak valid" };
  }
  if (q.leadTimeDays! > item.maxDeliveryDays) {
    return { reason: "LEAD_TIME_TOO_LONG", detail: `${q.leadTimeDays} hari > batas ${item.maxDeliveryDays} hari` };
  }
  if (item.maximumUnitPrice !== null && qi.quotedUnitPrice > item.maximumUnitPrice) {
    return { reason: "PRICE_ABOVE_MAXIMUM", detail: `${qi.quotedUnitPrice} > harga maksimum ${item.maximumUnitPrice}` };
  }
  if (qi.availableQuantity === null) {
    return { reason: "AVAILABLE_QUANTITY_UNKNOWN", detail: "stok penawaran belum dinyatakan" };
  }

  let availableMilli: number;
  let moqMilli: number;
  let stepMilli: number;
  try {
    availableMilli = toMilli(qi.availableQuantity);
    moqMilli = toMilli(qi.minimumOrderQuantity);
    stepMilli = stepFor(item, qi.packSize);
  } catch (e) {
    return { reason: "INVALID_DATA", detail: e instanceof InvalidData ? e.message : "data kuantitas tidak valid" };
  }
  if (stepMilli <= 0 || moqMilli < 0 || availableMilli < 0) return { reason: "INVALID_DATA", detail: "pack/MOQ/stok tidak valid" };
  if (availableMilli === 0) return { reason: "OUT_OF_STOCK", detail: "stok penawaran 0" };

  const capMilli = Math.min(availableMilli, requiredMilli + overbuyMilli);
  const nMax = Math.floor(capMilli / stepMilli);
  const nMin = Math.max(1, Math.ceil(moqMilli / stepMilli));
  if (nMax < nMin) {
    return {
      reason: "MOQ_OR_PACK_EXCEEDS_LIMIT",
      detail: `minimum pembelian ${nMin * stepMilli / MILLI} melebihi batas yang boleh dibeli ${nMax * stepMilli / MILLI}`,
    };
  }
  const costPerStep = new Decimal(qi.quotedUnitPrice).times(stepMilli).div(MILLI).ceil().toNumber();
  const nMaxByStock = Math.floor(availableMilli / stepMilli);
  return { unitPrice: qi.quotedUnitPrice, stepMilli, nMin, nMax, nMaxByStock, costPerStep };
}

function reject(
  list: IneligibleOffer[],
  q: OptimizerQuotation,
  productId: string,
  reason: RejectionReason,
  detail: string,
) {
  list.push({ quotationId: q.quotationId, supplierId: q.supplierId, supplierName: q.supplierName, productId, reason, detail });
}
