import Decimal from "decimal.js";
import type { Db } from "@/lib/db/types";

/** PO yang barangnya belum (sepenuhnya) diterima. */
export const OUTSTANDING_PO_STATUSES = ["CREATED", "SENT", "PARTIALLY_RECEIVED"] as const;

/**
 * Incoming Quantity per produk (SUPPLIO.md §2): total kuantitas PO outstanding dikurangi yang sudah diterima.
 * Dihitung dari data PO, bukan input terpisah.
 */
export async function getIncomingQuantities(db: Db, businessId: string): Promise<Map<string, Decimal>> {
  const statuses = [...OUTSTANDING_PO_STATUSES];

  const items = await db.purchaseOrderItem.findMany({
    where: { purchaseOrder: { businessId, status: { in: statuses } } },
    select: { purchaseOrderId: true, productId: true, quantity: true },
  });
  if (items.length === 0) return new Map();

  const receipts = await db.goodsReceiptItem.findMany({
    where: { goodsReceipt: { purchaseOrder: { businessId, status: { in: statuses } } } },
    select: {
      productId: true,
      receivedQuantity: true,
      goodsReceipt: { select: { purchaseOrderId: true } },
    },
  });

  const received = new Map<string, Decimal>();
  for (const r of receipts) {
    const key = `${r.goodsReceipt.purchaseOrderId}|${r.productId}`;
    received.set(key, (received.get(key) ?? new Decimal(0)).plus(r.receivedQuantity.toString()));
  }

  const incoming = new Map<string, Decimal>();
  for (const item of items) {
    const got = received.get(`${item.purchaseOrderId}|${item.productId}`) ?? new Decimal(0);
    const outstanding = Decimal.max(0, new Decimal(item.quantity.toString()).minus(got));
    incoming.set(item.productId, (incoming.get(item.productId) ?? new Decimal(0)).plus(outstanding));
  }
  return incoming;
}
