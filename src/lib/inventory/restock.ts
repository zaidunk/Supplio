import Decimal from "decimal.js";

/**
 * Perhitungan restock murni (SUPPLIO.md §4.1). Tidak menyentuh DB/LLM; semua angka kuantitas Decimal.
 * Nilai Prisma.Decimal, string, dan number diterima lewat `toString()`.
 */
export type DecimalInput = { toString(): string };

const dec = (v: DecimalInput): Decimal => new Decimal(v.toString());

export const PLANNING_FIELDS = ["dailyConsumption", "plannedLeadTimeDays", "targetCoverageDays"] as const;
export type PlanningField = (typeof PLANNING_FIELDS)[number];

export interface RestockInput {
  currentStock: DecimalInput;
  /** Dihitung dari PO outstanding (getIncomingQuantities), bukan input pengguna. */
  incomingQuantity: DecimalInput;
  manualThreshold: DecimalInput;
  safetyStock: DecimalInput;
  /** Jumlah desimal yang diizinkan untuk satuan produk (0 = bilangan bulat). */
  quantityScale: number;
  dailyConsumption: DecimalInput | null;
  plannedLeadTimeDays: number | null;
  targetCoverageDays: number | null;
}

export type RestockEvaluation =
  | { status: "CONFIGURATION_REQUIRED"; missing: PlanningField[]; inventoryPosition: Decimal }
  | {
      status: "OK";
      inventoryPosition: Decimal;
      reorderPoint: Decimal;
      targetStock: Decimal;
      requiredQuantity: Decimal;
      triggerRestock: boolean;
    };

export function computeRestock(input: RestockInput): RestockEvaluation {
  const inventoryPosition = dec(input.currentStock).plus(dec(input.incomingQuantity));

  const missing = PLANNING_FIELDS.filter((f) => input[f] === null || input[f] === undefined);
  if (
    input.dailyConsumption === null ||
    input.plannedLeadTimeDays === null ||
    input.targetCoverageDays === null
  ) {
    return { status: "CONFIGURATION_REQUIRED", missing, inventoryPosition };
  }

  const daily = dec(input.dailyConsumption);
  const lead = new Decimal(input.plannedLeadTimeDays);
  const coverage = new Decimal(input.targetCoverageDays);
  const safety = dec(input.safetyStock);

  // reorderPoint = max(manualThreshold, daily * lead + safetyStock)
  const reorderPoint = Decimal.max(dec(input.manualThreshold), daily.times(lead).plus(safety));
  // targetStock = daily * (lead + coverage) + safetyStock
  const targetStock = daily.times(lead.plus(coverage)).plus(safety);
  // requiredQuantity = max(0, targetStock - inventoryPosition), dibulatkan KE ATAS ke presisi satuan
  // agar kebutuhan tidak pernah kurang dari yang dihitung.
  const requiredQuantity = Decimal.max(0, targetStock.minus(inventoryPosition)).toDecimalPlaces(
    input.quantityScale,
    Decimal.ROUND_UP,
  );

  return {
    status: "OK",
    inventoryPosition,
    reorderPoint,
    targetStock,
    requiredQuantity,
    triggerRestock: inventoryPosition.lte(reorderPoint) && requiredQuantity.gt(0),
  };
}

/**
 * Peringatan risiko stockout (§4.1): stok fisik diperkirakan habis lebih cepat dari batas kedatangan.
 * Memakai stok fisik, bukan inventoryPosition, karena barang incoming belum bisa dipakai.
 */
export function estimateStockoutRisk(input: {
  currentStock: DecimalInput;
  dailyConsumption: DecimalInput | null;
  maxDeliveryDays: number;
}): { daysOfCover: Decimal | null; atRisk: boolean } {
  if (input.dailyConsumption === null) return { daysOfCover: null, atRisk: false };
  const daily = dec(input.dailyConsumption);
  if (daily.lte(0)) return { daysOfCover: null, atRisk: false };
  const daysOfCover = dec(input.currentStock).div(daily);
  return { daysOfCover, atRisk: daysOfCover.lt(input.maxDeliveryDays) };
}
