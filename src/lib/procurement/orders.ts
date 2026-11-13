import { randomBytes } from "node:crypto";
import Decimal from "decimal.js";
import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/lib/errors";
import type { TelegramClient } from "@/lib/telegram/client";
import { buildOrderMessage } from "@/lib/telegram/messages";
import { sendToSupplier } from "@/lib/telegram/outbound";

/** Nomor PO tampilan: PO-<tanggal WIB>-<6 hex>. Keunikan dijaga constraint database. */
export function generatePoNumber(now: Date): string {
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(now).replaceAll("-", "");
  return `PO-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Biaya baris = ceil(harga × kuantitas): sama persis dengan optimizer/validator agar total konsisten. */
export const lineCost = (unitPrice: number, quantity: string | { toString(): string }): number =>
  new Decimal(unitPrice).times(quantity.toString()).ceil().toNumber();

export interface SendConfirmationsResult {
  sent: number;
  /** PO yang belum terkirim (supplier tidak terhubung/diblokir). PO tetap sah; pemilik dapat mengirim ulang. */
  failed: { poNumber: string; reason: string }[];
}

/**
 * Kirim konfirmasi pemesanan ke supplier untuk PO yang SUDAH sah (status CREATED, belum terkirim), dengan nomor PO
 * (SUPPLIO.md §4.3, §10 langkah 8). Idempoten: kunci `po:<id>:order` per PO, sehingga retry/klik ulang tidak
 * mengirim pesan kedua. Kegagalan mengirim tidak membatalkan PO.
 */
export async function sendOrderConfirmations(
  db: PrismaClient,
  tg: TelegramClient,
  params: { businessId: string; requestId?: string; purchaseOrderId?: string; now?: Date },
): Promise<SendConfirmationsResult> {
  const now = params.now ?? new Date();
  const orders = await db.purchaseOrder.findMany({
    where: {
      businessId: params.businessId,
      ...(params.requestId ? { requestId: params.requestId } : {}),
      ...(params.purchaseOrderId ? { id: params.purchaseOrderId } : {}),
      status: "CREATED",
      sentAt: null,
    },
    orderBy: { createdAt: "asc" },
    include: {
      supplier: { select: { name: true } },
      request: { select: { business: { select: { name: true } } } },
      items: { include: { product: { select: { name: true, unit: true } } } },
    },
  });

  const result: SendConfirmationsResult = { sent: 0, failed: [] };
  for (const po of orders) {
    const quotation = await db.quotation.findFirst({
      where: { supplierId: po.supplierId, status: "CONFIRMED", session: { requestId: po.requestId } },
      orderBy: { confirmedAt: { sort: "desc", nulls: "last" } },
      select: { leadTimeDays: true },
    });

    try {
      await sendToSupplier(db, tg, {
        supplierId: po.supplierId,
        text: buildOrderMessage({
          businessName: po.request.business.name,
          supplierName: po.supplier.name,
          poNumber: po.poNumber,
          items: po.items
            .map((i) => ({
              productName: i.product.name,
              quantity: i.quantity.toString(),
              unit: i.product.unit,
              unitPrice: i.unitPrice,
              lineCost: lineCost(i.unitPrice, i.quantity),
            }))
            .sort((a, b) => a.productName.localeCompare(b.productName)),
          shippingFee: po.shippingFee,
          totalCost: po.totalCost,
          leadTimeDays: quotation?.leadTimeDays ?? null,
        }),
        idempotencyKey: `po:${po.id}:order`,
        sender: "SYSTEM",
      });
      await db.purchaseOrder.updateMany({ where: { id: po.id, status: "CREATED", sentAt: null }, data: { status: "SENT", sentAt: now } });
      result.sent++;
    } catch (e) {
      if (e instanceof DomainError && (e.code === "SUPPLIER_NOT_CONNECTED" || e.code === "SUPPLIER_UNREACHABLE")) {
        result.failed.push({ poNumber: po.poNumber, reason: e.message });
        continue;
      }
      throw e; // galat sementara → biarkan di-retry; kunci idempotensi mencegah pesan ganda
    }
  }
  return result;
}
