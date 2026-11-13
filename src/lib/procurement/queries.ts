import type { ProcurementStatus } from "@/generated/prisma/client";
import type { Db } from "@/lib/db/types";
import { DomainError } from "@/lib/errors";
import { estimateStockoutRisk } from "@/lib/inventory/restock";

export interface RequestListRow {
  id: string;
  status: ProcurementStatus;
  restockBudget: number;
  itemCount: number;
  createdAt: string;
  expiresAt: string | null;
}

export async function listRequests(db: Db, businessId: string): Promise<RequestListRow[]> {
  const rows = await db.procurementRequest.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      restockBudget: true,
      createdAt: true,
      expiresAt: true,
      _count: { select: { items: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    restockBudget: r.restockBudget,
    itemCount: r._count.items,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt?.toISOString() ?? null,
  }));
}

export interface RequestDetail {
  id: string;
  status: ProcurementStatus;
  restockBudget: number;
  aiSettingsVersion: number;
  createdAt: string;
  expiresAt: string | null;
  items: {
    productId: string;
    productName: string;
    unit: string;
    requiredQuantity: string;
    maxDeliveryDays: number;
    allowedOverbuyQuantity: string;
    stockoutRisk: boolean;
    daysOfCover: string | null;
  }[];
  transitions: { fromStatus: ProcurementStatus | null; toStatus: ProcurementStatus; reason: string | null; createdAt: string }[];
}

export async function getRequestDetail(db: Db, businessId: string, requestId: string): Promise<RequestDetail> {
  const r = await db.procurementRequest.findFirst({
    where: { id: requestId, businessId },
    include: {
      items: { include: { product: { select: { name: true, unit: true, currentStock: true, dailyConsumption: true } } } },
      transitions: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!r) throw new DomainError("REQUEST_NOT_FOUND", "Procurement request tidak ditemukan.", 404);

  return {
    id: r.id,
    status: r.status,
    restockBudget: r.restockBudget,
    aiSettingsVersion: r.aiSettingsVersion,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt?.toISOString() ?? null,
    items: r.items
      .map((i) => {
        const risk = estimateStockoutRisk({
          currentStock: i.product.currentStock,
          dailyConsumption: i.product.dailyConsumption,
          maxDeliveryDays: i.maxDeliveryDays,
        });
        return {
          productId: i.productId,
          productName: i.product.name,
          unit: i.product.unit,
          requiredQuantity: i.requiredQuantity.toString(),
          maxDeliveryDays: i.maxDeliveryDays,
          allowedOverbuyQuantity: i.allowedOverbuyQuantity.toString(),
          stockoutRisk: risk.atRisk,
          daysOfCover: risk.daysOfCover?.toDecimalPlaces(1).toString() ?? null,
        };
      })
      .sort((a, b) => a.productName.localeCompare(b.productName)),
    transitions: r.transitions.map((t) => ({
      fromStatus: t.fromStatus,
      toStatus: t.toStatus,
      reason: t.reason,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}
