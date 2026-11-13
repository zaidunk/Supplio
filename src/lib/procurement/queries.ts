import type { NegotiationStatus, ProcurementStatus } from "@/generated/prisma/client";
import type { Db } from "@/lib/db/types";
import { DomainError } from "@/lib/errors";
import { estimateStockoutRisk } from "@/lib/inventory/restock";
import { lineCost } from "./orders";
import { listPurchaseOrders, type PurchaseOrderRow } from "./receiving";

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
  /** Satu sesi per supplier yang dihubungi, lengkap dengan percakapan Telegram (pesan supplier = data mentah). */
  sessions: {
    id: string;
    supplierName: string;
    status: NegotiationStatus;
    negotiationRound: number;
    expiresAt: string | null;
    messages: { id: string; direction: "INBOUND" | "OUTBOUND"; sender: "SUPPLIER" | "AI" | "SYSTEM"; content: string; createdAt: string }[];
    /** Penawaran terstruktur hasil ekstraksi (terlama → terbaru); yang CONFIRMED dan terbaru dipakai optimasi. */
    quotations: {
      id: string;
      status: "DRAFT" | "NEEDS_CLARIFICATION" | "CONFIRMED" | "REJECTED" | "EXPIRED";
      shippingFee: number | null;
      leadTimeDays: number | null;
      items: { productName: string; unit: string; quotedUnitPrice: number; availableQuantity: string | null; minimumOrderQuantity: string; packSize: string | null }[];
    }[];
  }[];
  /** Hasil optimasi terbaru. Belum ada komitmen order sampai pemilik menyetujui. */
  recommendation: {
    id: string;
    solverStatus: "OPTIMAL" | "NO_FEASIBLE_SOLUTION" | "ERROR";
    totalCost: number;
    remainingBudget: number;
    explanation: string;
    createdAt: string;
    /** Rincian per supplier terpilih: barang, harga, ongkir (sekali per supplier), dan total. */
    suppliers: {
      supplierId: string;
      supplierName: string;
      shippingFee: number;
      itemsCost: number;
      total: number;
      items: { productName: string; unit: string; quantity: string; unitPrice: number; lineCost: number }[];
    }[];
  } | null;
  /** PO yang lahir dari Final Approval. */
  purchaseOrders: PurchaseOrderRow[];
}

export async function getRequestDetail(db: Db, businessId: string, requestId: string): Promise<RequestDetail> {
  const r = await db.procurementRequest.findFirst({
    where: { id: requestId, businessId },
    include: {
      items: { include: { product: { select: { name: true, unit: true, currentStock: true, dailyConsumption: true } } } },
      transitions: { orderBy: { createdAt: "asc" } },
      sessions: {
        orderBy: { createdAt: "asc" },
        include: {
          supplier: { select: { name: true } },
          messages: { orderBy: { createdAt: "asc" }, take: 200 },
          quotations: {
            orderBy: { createdAt: "asc" },
            include: { items: { include: { product: { select: { name: true, unit: true } } } } },
          },
        },
      },
      recommendations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          suppliers: { include: { supplier: { select: { name: true } } } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
      },
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
    sessions: r.sessions.map((s) => ({
      id: s.id,
      supplierName: s.supplier.name,
      status: s.status,
      negotiationRound: s.negotiationRound,
      expiresAt: s.expiresAt?.toISOString() ?? null,
      messages: s.messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        sender: m.sender,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
      quotations: s.quotations.map((q) => ({
        id: q.id,
        status: q.status,
        shippingFee: q.shippingFee,
        leadTimeDays: q.leadTimeDays,
        items: q.items.map((i) => ({
          productName: i.product.name,
          unit: i.product.unit,
          quotedUnitPrice: i.quotedUnitPrice,
          availableQuantity: i.availableQuantity?.toString() ?? null,
          minimumOrderQuantity: i.minimumOrderQuantity.toString(),
          packSize: i.packSize?.toString() ?? null,
        })),
      })),
    })),
    recommendation: r.recommendations[0]
      ? {
          id: r.recommendations[0].id,
          solverStatus: r.recommendations[0].solverStatus,
          totalCost: r.recommendations[0].totalCost,
          remainingBudget: r.recommendations[0].remainingBudget,
          explanation: r.recommendations[0].explanation,
          createdAt: r.recommendations[0].createdAt.toISOString(),
          suppliers: r.recommendations[0].suppliers
            .map((s) => {
              const items = r.recommendations[0].items
                .filter((i) => i.supplierId === s.supplierId)
                .map((i) => ({
                  productName: i.product.name,
                  unit: i.product.unit,
                  quantity: i.quantity.toString(),
                  unitPrice: i.unitPrice,
                  lineCost: lineCost(i.unitPrice, i.quantity),
                }))
                .sort((a, b) => a.productName.localeCompare(b.productName));
              const itemsCost = items.reduce((sum, i) => sum + i.lineCost, 0);
              return { supplierId: s.supplierId, supplierName: s.supplier.name, shippingFee: s.shippingFee, itemsCost, total: itemsCost + s.shippingFee, items };
            })
            .sort((a, b) => a.supplierName.localeCompare(b.supplierName)),
        }
      : null,
    purchaseOrders: await listPurchaseOrders(db, businessId, { requestId }),
  };
}
