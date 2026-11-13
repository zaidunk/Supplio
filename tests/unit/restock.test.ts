import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { computeRestock, estimateStockoutRisk, type RestockInput } from "@/lib/inventory/restock";

// Contoh dari seed: Bawang Putih — harian 5, lead 2 hari, safety 5, coverage 5, threshold 10.
const base: RestockInput = {
  currentStock: "12",
  incomingQuantity: "0",
  manualThreshold: "10",
  safetyStock: "5",
  quantityScale: 1,
  dailyConsumption: "5",
  plannedLeadTimeDays: 2,
  targetCoverageDays: 5,
};

const ok = (input: Partial<RestockInput>) => {
  const r = computeRestock({ ...base, ...input });
  if (r.status !== "OK") throw new Error(`expected OK, got ${r.status}`);
  return r;
};

describe("computeRestock — rumus §4.1", () => {
  it("menghitung reorderPoint, targetStock, dan requiredQuantity dengan benar", () => {
    const r = ok({});
    expect(r.reorderPoint.toString()).toBe("15"); // max(10, 5*2+5)
    expect(r.targetStock.toString()).toBe("40"); // 5*(2+5)+5
    expect(r.inventoryPosition.toString()).toBe("12");
    expect(r.requiredQuantity.toString()).toBe("28"); // 40-12
    expect(r.triggerRestock).toBe(true);
  });

  it("memicu tepat pada batas (inventoryPosition == reorderPoint)", () => {
    const r = ok({ currentStock: "15" });
    expect(r.triggerRestock).toBe(true);
    expect(r.requiredQuantity.toString()).toBe("25");
  });

  it("tidak memicu bila di atas reorderPoint", () => {
    expect(ok({ currentStock: "16" }).triggerRestock).toBe(false);
  });

  it("manualThreshold menjadi lantai reorderPoint", () => {
    const r = ok({ manualThreshold: "30", currentStock: "25" });
    expect(r.reorderPoint.toString()).toBe("30");
    expect(r.triggerRestock).toBe(true);
  });

  it("incomingQuantity dari PO outstanding mencegah restock ganda", () => {
    const r = ok({ currentStock: "12", incomingQuantity: "28" });
    expect(r.inventoryPosition.toString()).toBe("40");
    expect(r.requiredQuantity.toString()).toBe("0");
    expect(r.triggerRestock).toBe(false);
  });

  it("incoming sebagian: posisi di atas reorderPoint tidak memicu walau masih ada selisih ke target", () => {
    const r = ok({ currentStock: "12", incomingQuantity: "10" });
    expect(r.inventoryPosition.toString()).toBe("22");
    expect(r.requiredQuantity.toString()).toBe("18");
    expect(r.triggerRestock).toBe(false); // 22 > reorderPoint 15
  });

  it("incoming kecil: posisi masih <= reorderPoint, kebutuhan dikurangi incoming", () => {
    const r = ok({ currentStock: "12", incomingQuantity: "2" });
    expect(r.inventoryPosition.toString()).toBe("14");
    expect(r.requiredQuantity.toString()).toBe("26");
    expect(r.triggerRestock).toBe(true);
  });

  it("tidak memicu bila requiredQuantity 0 walau position <= reorderPoint", () => {
    const r = ok({ manualThreshold: "100", dailyConsumption: "1", plannedLeadTimeDays: 1, targetCoverageDays: 1, safetyStock: "0", currentStock: "50" });
    expect(r.inventoryPosition.lte(r.reorderPoint)).toBe(true);
    expect(r.requiredQuantity.toString()).toBe("0");
    expect(r.triggerRestock).toBe(false);
  });

  it("membulatkan requiredQuantity KE ATAS ke presisi satuan", () => {
    const common = { dailyConsumption: "0.3", plannedLeadTimeDays: 1, targetCoverageDays: 1, safetyStock: "0", manualThreshold: "0", currentStock: "0" };
    expect(ok({ ...common, quantityScale: 0 }).requiredQuantity.toString()).toBe("1"); // 0.6 -> 1
    expect(ok({ ...common, quantityScale: 1 }).requiredQuantity.toString()).toBe("0.6");
    expect(ok({ ...common, dailyConsumption: "0.33", quantityScale: 1 }).requiredQuantity.toString()).toBe("0.7"); // 0.66 -> 0.7
  });

  it("presisi desimal tepat (bukan float)", () => {
    const r = ok({ dailyConsumption: "0.1", plannedLeadTimeDays: 3, targetCoverageDays: 0, safetyStock: "0.2", currentStock: "0", manualThreshold: "0", quantityScale: 3 });
    expect(r.targetStock.toString()).toBe("0.5"); // 0.1*3+0.2, tanpa 0.5000000001
  });

  it("melaporkan konfigurasi wajib yang belum lengkap", () => {
    const r = computeRestock({ ...base, dailyConsumption: null, targetCoverageDays: null });
    expect(r.status).toBe("CONFIGURATION_REQUIRED");
    if (r.status === "CONFIGURATION_REQUIRED") {
      expect(r.missing).toEqual(["dailyConsumption", "targetCoverageDays"]);
      expect(r.inventoryPosition.toString()).toBe("12");
    }
  });

  it("dailyConsumption 0 sah (bukan konfigurasi hilang)", () => {
    const r = computeRestock({ ...base, dailyConsumption: "0" });
    expect(r.status).toBe("OK");
  });

  it("menerima objek mirip Prisma.Decimal, string, dan number", () => {
    const prismaLike = { toString: () => "12.5" };
    const r = ok({ currentStock: prismaLike, incomingQuantity: 0, manualThreshold: new Decimal(10) });
    expect(r.inventoryPosition.toString()).toBe("12.5");
  });
});

describe("estimateStockoutRisk", () => {
  it("berisiko bila stok fisik habis sebelum batas kedatangan", () => {
    const r = estimateStockoutRisk({ currentStock: "5", dailyConsumption: "5", maxDeliveryDays: 2 });
    expect(r.daysOfCover?.toString()).toBe("1");
    expect(r.atRisk).toBe(true);
  });

  it("aman bila stok cukup melewati batas", () => {
    expect(estimateStockoutRisk({ currentStock: "12", dailyConsumption: "5", maxDeliveryDays: 2 }).atRisk).toBe(false);
  });

  it("tanpa konsumsi tidak ada risiko yang bisa dihitung", () => {
    expect(estimateStockoutRisk({ currentStock: "1", dailyConsumption: null, maxDeliveryDays: 2 })).toEqual({ daysOfCover: null, atRisk: false });
    expect(estimateStockoutRisk({ currentStock: "1", dailyConsumption: "0", maxDeliveryDays: 2 }).atRisk).toBe(false);
  });
});
