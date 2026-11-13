import Decimal from "decimal.js";
import type { Db } from "@/lib/db/types";
import type { ProcurementStatus, PrismaClient, PurchaseOrderStatus } from "@/generated/prisma/client";
import { DomainError } from "@/lib/errors";
import { transitionRequestTx } from "./transition";

export interface ReceiptItemInput {
  productId: string;
  /** Desimal sebagai string; harus > 0 dan tidak melebihi outstanding PO. */
  receivedQuantity: string;
}

export interface ReceiptResult {
  receiptId: string;
  duplicate: boolean;
  purchaseOrderStatus: PurchaseOrderStatus;
  requestStatus: ProcurementStatus;
}

const RECEIVABLE: PurchaseOrderStatus[] = ["CREATED", "SENT", "PARTIALLY_RECEIVED"];

/**
 * Catat penerimaan barang aktual, parsial atau penuh (SUPPLIO.md §4.3, §10 langkah 9). Stok bertambah HANYA di sini
 * dan hanya sebesar jumlah yang diterima; membuat PO tidak menambah stok. Dalam satu transaksi dengan kunci baris pada PO:
 *  - kuantitas melebihi outstanding ditolak (koreksi lewat penyesuaian stok eksplisit, bukan lewat penerimaan);
 *  - kunci idempotensi yang sama tidak menambah stok dua kali;
 *  - status PO dan request (PARTIALLY_RECEIVED / COMPLETED) dihitung dari data penerimaan.
 */
export async function recordGoodsReceipt(
  db: PrismaClient,
  params: { businessId: string; purchaseOrderId: string; items: ReceiptItemInput[]; idempotencyKey: string; note?: string; now?: Date },
): Promise<ReceiptResult> {
  const { businessId, purchaseOrderId } = params;
  const now = params.now ?? new Date();
  const key = `${businessId}:${params.idempotencyKey}`;

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${purchaseOrderId} AND "businessId" = ${businessId} FOR UPDATE`;

    const po = await tx.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, businessId },
      select: {
        id: true,
        poNumber: true,
        status: true,
        requestId: true,
        items: { select: { productId: true, quantity: true, unitPrice: true, product: { select: { name: true, quantityScale: true } } } },
      },
    });
    if (!po) throw new DomainError("PO_NOT_FOUND", "Purchase order tidak ditemukan.", 404);

    const existing = await tx.goodsReceipt.findUnique({ where: { idempotencyKey: key }, select: { id: true, purchaseOrderId: true } });
    if (existing) {
      if (existing.purchaseOrderId !== po.id) throw new DomainError("IDEMPOTENCY_KEY_REUSED", "Kunci idempotensi sudah dipakai untuk PO lain.", 409);
      const request = await tx.procurementRequest.findUniqueOrThrow({ where: { id: po.requestId }, select: { status: true } });
      return { receiptId: existing.id, duplicate: true, purchaseOrderStatus: po.status, requestStatus: request.status };
    }

    if (!RECEIVABLE.includes(po.status)) {
      throw new DomainError("PO_NOT_RECEIVABLE", po.status === "RECEIVED" ? "PO ini sudah diterima penuh." : `PO berstatus ${po.status} tidak dapat menerima barang.`, 409);
    }
    if (params.items.length === 0) throw new DomainError("EMPTY_RECEIPT", "Tidak ada barang yang diterima.", 400);

    const byProduct = new Map(po.items.map((i) => [i.productId, i]));
    const seen = new Set<string>();
    const received = await tx.goodsReceiptItem.groupBy({
      by: ["productId"],
      where: { goodsReceipt: { purchaseOrderId: po.id } },
      _sum: { receivedQuantity: true },
    });
    const receivedSoFar = new Map(received.map((r) => [r.productId, new Decimal(r._sum.receivedQuantity?.toString() ?? "0")]));

    const lines: { productId: string; qty: Decimal; unitPrice: number }[] = [];
    for (const input of params.items) {
      const item = byProduct.get(input.productId);
      if (!item) throw new DomainError("PRODUCT_NOT_IN_PO", "Ada barang yang tidak termasuk dalam PO ini.", 400);
      if (seen.has(input.productId)) throw new DomainError("DUPLICATE_PRODUCT", "Barang yang sama muncul lebih dari sekali.", 400);
      seen.add(input.productId);

      let qty: Decimal;
      try {
        qty = new Decimal(input.receivedQuantity);
      } catch {
        throw new DomainError("INVALID_QUANTITY", `Kuantitas "${input.receivedQuantity}" tidak valid.`, 400);
      }
      if (!qty.isFinite() || qty.lte(0)) throw new DomainError("INVALID_QUANTITY", "Kuantitas diterima harus lebih dari 0.", 400);
      if (qty.decimalPlaces() > item.product.quantityScale) {
        throw new DomainError("QUANTITY_SCALE_EXCEEDED", `${item.product.name}: hanya mengizinkan ${item.product.quantityScale} desimal.`, 400);
      }
      const outstanding = new Decimal(item.quantity.toString()).minus(receivedSoFar.get(input.productId) ?? 0);
      if (qty.gt(outstanding)) {
        throw new DomainError(
          "RECEIPT_EXCEEDS_OUTSTANDING",
          `${item.product.name}: diterima ${qty} melebihi sisa pesanan ${outstanding}. Selisih dicatat lewat penyesuaian stok, bukan penerimaan.`,
          409,
        );
      }
      lines.push({ productId: input.productId, qty, unitPrice: item.unitPrice });
    }

    const receipt = await tx.goodsReceipt.create({
      data: {
        purchaseOrderId: po.id,
        receivedAt: now,
        idempotencyKey: key,
        items: { create: lines.map((l) => ({ productId: l.productId, receivedQuantity: l.qty.toString() })) },
      },
      select: { id: true },
    });

    for (const l of lines) {
      await tx.product.update({
        where: { id: l.productId },
        data: { currentStock: { increment: l.qty.toString() }, lastPurchaseUnitPrice: l.unitPrice },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: l.productId,
          type: "IN",
          quantity: l.qty.toString(),
          note: params.note?.trim().slice(0, 300) || `Penerimaan PO ${po.poNumber}`,
          referenceId: receipt.id,
          idempotencyKey: `receipt:${receipt.id}:${l.productId}`,
        },
      });
      receivedSoFar.set(l.productId, (receivedSoFar.get(l.productId) ?? new Decimal(0)).plus(l.qty));
    }

    const fullyReceived = po.items.every((i) => new Decimal(i.quantity.toString()).minus(receivedSoFar.get(i.productId) ?? 0).lte(0));
    const poStatus: PurchaseOrderStatus = fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: poStatus } });

    // Request selesai hanya bila SEMUA PO-nya (yang tidak dibatalkan) sudah diterima penuh.
    const openOrders = await tx.purchaseOrder.count({
      where: { requestId: po.requestId, status: { notIn: ["RECEIVED", "CANCELLED"] } },
    });
    const target: ProcurementStatus = openOrders === 0 ? "COMPLETED" : "PARTIALLY_RECEIVED";
    await transitionRequestTx(tx, {
      requestId: po.requestId,
      businessId,
      to: target,
      reason: target === "COMPLETED" ? "Semua PO diterima penuh" : `Penerimaan sebagian PO ${po.poNumber}`,
    });

    return { receiptId: receipt.id, duplicate: false, purchaseOrderStatus: poStatus, requestStatus: target };
  });
}

export interface PurchaseOrderRow {
  id: string;
  poNumber: string;
  requestId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  shippingFee: number;
  totalCost: number;
  sentAt: string | null;
  createdAt: string;
  items: { productId: string; productName: string; unit: string; quantityScale: number; ordered: string; received: string; outstanding: string; unitPrice: number }[];
  receipts: { id: string; receivedAt: string; items: { productName: string; receivedQuantity: string }[] }[];
}

/** Daftar PO beserta kuantitas dipesan/diterima/outstanding (dihitung dari catatan penerimaan). */
export async function listPurchaseOrders(
  db: Db,
  businessId: string,
  filter: { requestId?: string; id?: string; outstandingOnly?: boolean } = {},
): Promise<PurchaseOrderRow[]> {
  const orders = await db.purchaseOrder.findMany({
    where: {
      businessId,
      ...(filter.requestId ? { requestId: filter.requestId } : {}),
      ...(filter.id ? { id: filter.id } : {}),
      ...(filter.outstandingOnly ? { status: { in: ["CREATED", "SENT", "PARTIALLY_RECEIVED"] as PurchaseOrderStatus[] } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      supplier: { select: { name: true } },
      items: { include: { product: { select: { name: true, unit: true, quantityScale: true } } } },
      receipts: { orderBy: { receivedAt: "desc" }, include: { items: { include: { product: { select: { name: true } } } } } },
    },
  });

  return orders.map((po) => {
    const receivedBy = new Map<string, Decimal>();
    for (const r of po.receipts) {
      for (const i of r.items) receivedBy.set(i.productId, (receivedBy.get(i.productId) ?? new Decimal(0)).plus(i.receivedQuantity.toString()));
    }
    return {
      id: po.id,
      poNumber: po.poNumber,
      requestId: po.requestId,
      supplierName: po.supplier.name,
      status: po.status,
      shippingFee: po.shippingFee,
      totalCost: po.totalCost,
      sentAt: po.sentAt?.toISOString() ?? null,
      createdAt: po.createdAt.toISOString(),
      items: po.items
        .map((i) => {
          const got = receivedBy.get(i.productId) ?? new Decimal(0);
          return {
            productId: i.productId,
            productName: i.product.name,
            unit: i.product.unit,
            quantityScale: i.product.quantityScale,
            ordered: i.quantity.toString(),
            received: got.toString(),
            outstanding: Decimal.max(0, new Decimal(i.quantity.toString()).minus(got)).toString(),
            unitPrice: i.unitPrice,
          };
        })
        .sort((a, b) => a.productName.localeCompare(b.productName)),
      receipts: po.receipts.map((r) => ({
        id: r.id,
        receivedAt: r.receivedAt.toISOString(),
        items: r.items.map((i) => ({ productName: i.product.name, receivedQuantity: i.receivedQuantity.toString() })),
      })),
    };
  });
}
