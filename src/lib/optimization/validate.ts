import Decimal from "decimal.js";
import type { OptimizerInput, PricedLine, ProposedLine, SupplierCost, Totals, Violation } from "./types";

/**
 * Validator INDEPENDEN (SUPPLIO.md §4.2, §4.3): menghitung ulang seluruh angka dan memeriksa SEMUA batasan dari
 * data penawaran asli. Sengaja tidak memakai modul eligibility/solver, sehingga bug di salah satunya tidak
 * lolos diam-diam. Dipakai setelah solver dan lagi saat Final Approval.
 */
export interface ValidationResult {
  ok: boolean;
  violations: Violation[];
  /** Hanya terisi bila semua baris dapat dihitung (quotationItemId dikenal dan kuantitas valid). */
  totals: Totals | null;
}

export function validateSolution(input: OptimizerInput, proposed: ProposedLine[]): ValidationResult {
  const violations: Violation[] = [];
  const add = (v: Violation) => violations.push(v);

  const itemByProduct = new Map(input.items.map((i) => [i.productId, i]));
  const offerById = new Map<string, { q: OptimizerInput["quotations"][number]; qi: OptimizerInput["quotations"][number]["items"][number] }>();
  for (const q of input.quotations) for (const qi of q.items) offerById.set(qi.quotationItemId, { q, qi });

  const priced: PricedLine[] = [];
  const seenOffers = new Set<string>();
  const purchasedByProduct = new Map<string, Decimal>();
  let computable = true;

  for (const line of proposed) {
    const found = offerById.get(line.quotationItemId);
    if (!found) {
      add({ code: "UNKNOWN_OFFER", message: `Baris merujuk penawaran tak dikenal (${line.quotationItemId}).` });
      computable = false;
      continue;
    }
    const { q, qi } = found;
    const item = itemByProduct.get(qi.productId);
    if (!item) {
      add({ code: "PRODUCT_NOT_REQUESTED", message: "Produk tidak termasuk kebutuhan request.", productId: qi.productId, supplierId: q.supplierId });
      computable = false;
      continue;
    }
    if (seenOffers.has(line.quotationItemId)) {
      add({ code: "DUPLICATE_LINE", message: "Penawaran yang sama muncul lebih dari sekali.", productId: qi.productId, supplierId: q.supplierId });
    }
    seenOffers.add(line.quotationItemId);

    let qty: Decimal;
    try {
      qty = new Decimal(line.quantity);
    } catch {
      add({ code: "INVALID_QUANTITY", message: `Kuantitas "${line.quantity}" tidak valid.`, productId: qi.productId, supplierId: q.supplierId });
      computable = false;
      continue;
    }
    const ctx = { productId: qi.productId, supplierId: q.supplierId };
    const name = `${q.supplierName}/${item.productName}`;

    if (!qty.isFinite() || qty.lte(0)) add({ code: "INVALID_QUANTITY", message: `${name}: kuantitas harus > 0.`, ...ctx });
    if (qty.decimalPlaces() > item.quantityScale) {
      add({ code: "SCALE_EXCEEDED", message: `${name}: melebihi presisi satuan (${item.quantityScale} desimal).`, ...ctx });
    }
    if (q.status !== "CONFIRMED") add({ code: "QUOTATION_NOT_CONFIRMED", message: `${name}: penawaran belum CONFIRMED.`, ...ctx });
    if (q.validUntil !== null && q.validUntil.getTime() <= input.now.getTime()) {
      add({ code: "QUOTATION_EXPIRED", message: `${name}: penawaran sudah kedaluwarsa.`, ...ctx });
    }
    if (q.shippingFee === null || q.leadTimeDays === null) {
      add({ code: "TERMS_UNKNOWN", message: `${name}: ongkir/lead time belum jelas.`, ...ctx });
      computable = false;
      continue;
    }
    if (q.leadTimeDays > item.maxDeliveryDays) {
      add({ code: "LEAD_TIME_TOO_LONG", message: `${name}: lead time ${q.leadTimeDays} hari > batas ${item.maxDeliveryDays}.`, ...ctx });
    }
    if (item.maximumUnitPrice !== null && qi.quotedUnitPrice > item.maximumUnitPrice) {
      add({ code: "PRICE_ABOVE_MAXIMUM", message: `${name}: harga ${qi.quotedUnitPrice} melebihi maksimum ${item.maximumUnitPrice}.`, ...ctx });
    }
    if (qi.availableQuantity === null) {
      add({ code: "AVAILABLE_QUANTITY_UNKNOWN", message: `${name}: stok penawaran tidak dinyatakan.`, ...ctx });
    } else if (qty.gt(new Decimal(qi.availableQuantity))) {
      add({ code: "EXCEEDS_AVAILABLE", message: `${name}: ${qty} melebihi stok penawaran ${qi.availableQuantity}.`, ...ctx });
    }
    if (qty.lt(new Decimal(qi.minimumOrderQuantity))) {
      add({ code: "BELOW_MOQ", message: `${name}: ${qty} di bawah MOQ ${qi.minimumOrderQuantity}.`, ...ctx });
    }
    if (qi.packSize !== null) {
      const pack = new Decimal(qi.packSize);
      if (pack.lte(0) || !qty.mod(pack).isZero()) {
        add({ code: "NOT_PACK_MULTIPLE", message: `${name}: ${qty} bukan kelipatan kemasan ${qi.packSize}.`, ...ctx });
      }
    }

    purchasedByProduct.set(qi.productId, (purchasedByProduct.get(qi.productId) ?? new Decimal(0)).plus(qty));
    priced.push({
      quotationItemId: line.quotationItemId,
      quotationId: q.quotationId,
      supplierId: q.supplierId,
      supplierName: q.supplierName,
      productId: qi.productId,
      productName: item.productName,
      unit: item.unit,
      quantity: qty.toString(),
      unitPrice: qi.quotedUnitPrice,
      lineCost: new Decimal(qi.quotedUnitPrice).times(qty).ceil().toNumber(),
    });
  }

  // Kebutuhan terpenuhi dan overbuy tidak melebihi izin (§4.2 butir 1 dan 7).
  for (const item of input.items) {
    const bought = purchasedByProduct.get(item.productId) ?? new Decimal(0);
    const required = new Decimal(item.requiredQuantity);
    const ceiling = required.plus(new Decimal(item.allowedOverbuyQuantity));
    if (bought.lt(required)) {
      add({ code: "REQUIREMENT_NOT_MET", message: `${item.productName}: dibeli ${bought}, dibutuhkan ${required}.`, productId: item.productId });
    }
    if (bought.gt(ceiling)) {
      add({ code: "OVERBUY_EXCEEDED", message: `${item.productName}: dibeli ${bought} melebihi batas ${ceiling}.`, productId: item.productId });
    }
  }

  let totals: Totals | null = null;
  if (computable) {
    totals = computeTotals(input, priced);
    if (totals.totalCost > input.restockBudget) {
      add({ code: "BUDGET_EXCEEDED", message: `Total ${totals.totalCost} melebihi Restock Budget ${input.restockBudget}.` });
    }
  }
  return { ok: violations.length === 0, violations, totals };
}

/** Harga tiap baris = ceil(harga × kuantitas); ongkir dihitung SEKALI per supplier yang dipakai. */
export function computeTotals(input: OptimizerInput, lines: PricedLine[]): Totals {
  const quotationBySupplier = new Map(input.quotations.map((q) => [q.supplierId, q]));
  const bySupplier = new Map<string, SupplierCost>();

  for (const line of lines) {
    const q = quotationBySupplier.get(line.supplierId)!;
    const entry = bySupplier.get(line.supplierId) ?? {
      supplierId: line.supplierId,
      supplierName: line.supplierName,
      shippingFee: q.shippingFee ?? 0,
      itemsCost: 0,
      leadTimeDays: q.leadTimeDays ?? 0,
    };
    entry.itemsCost += line.lineCost;
    bySupplier.set(line.supplierId, entry);
  }

  const suppliers = [...bySupplier.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  const itemsCost = lines.reduce((s, l) => s + l.lineCost, 0);
  const shippingCost = suppliers.reduce((s, x) => s + x.shippingFee, 0);
  return { lines, suppliers, itemsCost, shippingCost, totalCost: itemsCost + shippingCost };
}
