import Decimal from "decimal.js";
import type { Db } from "@/lib/db/types";
import { SOURCING_ACTIVE_STATUSES } from "@/lib/procurement/lifecycle";
import { getIncomingQuantities } from "./incoming";
import { computeRestock, estimateStockoutRisk, type PlanningField } from "./restock";

export interface InventoryRow {
  id: string;
  name: string;
  unit: string;
  quantityScale: number;
  currentStock: string;
  lastPurchaseUnitPrice: number | null;
  dailyConsumption: string | null;
  manualThreshold: string;
  plannedLeadTimeDays: number | null;
  safetyStock: string;
  targetCoverageDays: number | null;
  maximumUnitPrice: number | null;
  allowedOverbuyQuantity: string;
  activeSupplierCount: number;
  incomingQuantity: string;
  inventoryPosition: string;
  /** Null bila konfigurasi perencanaan belum lengkap. */
  reorderPoint: string | null;
  targetStock: string | null;
  requiredQuantity: string | null;
  triggerRestock: boolean;
  configurationMissing: PlanningField[];
  stockoutRisk: boolean;
  daysOfCover: string | null;
  /** Barang ini sudah ada di proses sourcing aktif. */
  inActiveRequest: boolean;
}

/** Ringkasan inventaris + perhitungan restock; dipakai GET /api/products dan halaman Inventory. */
export async function getInventoryOverview(db: Db, businessId: string): Promise<InventoryRow[]> {
  const [products, incoming, activeItems] = await Promise.all([
    db.product.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      include: { _count: { select: { supplierProducts: { where: { supplier: { isActive: true } } } } } },
    }),
    getIncomingQuantities(db, businessId),
    db.procurementRequestItem.findMany({
      where: { businessId, request: { status: { in: [...SOURCING_ACTIVE_STATUSES] } } },
      select: { productId: true },
    }),
  ]);
  const inActive = new Set(activeItems.map((i) => i.productId));

  return products.map((p) => {
    const incomingQty = incoming.get(p.id) ?? new Decimal(0);
    const e = computeRestock({
      currentStock: p.currentStock,
      incomingQuantity: incomingQty,
      manualThreshold: p.manualThreshold,
      safetyStock: p.safetyStock,
      quantityScale: p.quantityScale,
      dailyConsumption: p.dailyConsumption,
      plannedLeadTimeDays: p.plannedLeadTimeDays,
      targetCoverageDays: p.targetCoverageDays,
    });
    const risk = estimateStockoutRisk({
      currentStock: p.currentStock,
      dailyConsumption: p.dailyConsumption,
      maxDeliveryDays: p.plannedLeadTimeDays ?? 0,
    });

    return {
      id: p.id,
      name: p.name,
      unit: p.unit,
      quantityScale: p.quantityScale,
      currentStock: p.currentStock.toString(),
      lastPurchaseUnitPrice: p.lastPurchaseUnitPrice,
      dailyConsumption: p.dailyConsumption?.toString() ?? null,
      manualThreshold: p.manualThreshold.toString(),
      plannedLeadTimeDays: p.plannedLeadTimeDays,
      safetyStock: p.safetyStock.toString(),
      targetCoverageDays: p.targetCoverageDays,
      maximumUnitPrice: p.maximumUnitPrice,
      allowedOverbuyQuantity: p.allowedOverbuyQuantity.toString(),
      activeSupplierCount: p._count.supplierProducts,
      incomingQuantity: incomingQty.toString(),
      inventoryPosition: e.inventoryPosition.toString(),
      reorderPoint: e.status === "OK" ? e.reorderPoint.toString() : null,
      targetStock: e.status === "OK" ? e.targetStock.toString() : null,
      requiredQuantity: e.status === "OK" ? e.requiredQuantity.toString() : null,
      triggerRestock: e.status === "OK" && e.triggerRestock,
      configurationMissing: e.status === "CONFIGURATION_REQUIRED" ? e.missing : [],
      stockoutRisk: risk.atRisk,
      daysOfCover: risk.daysOfCover?.toDecimalPlaces(1).toString() ?? null,
      inActiveRequest: inActive.has(p.id),
    };
  });
}
