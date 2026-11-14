import type { Db } from "@/lib/db/types";
import { OUTSTANDING_PO_STATUSES } from "@/lib/inventory/incoming";

/** Angka badge sidebar: dua COUNT ringan, bukan memuat daftar lengkap lalu menghitung di JS. */
export async function getNavBadgeCounts(db: Db, businessId: string) {
  const [awaitingApproval, openOrders] = await Promise.all([
    db.procurementRequest.count({ where: { businessId, status: "AWAITING_APPROVAL" } }),
    db.purchaseOrder.count({ where: { businessId, status: { in: [...OUTSTANDING_PO_STATUSES] } } }),
  ]);
  return { awaitingApproval, openOrders };
}
