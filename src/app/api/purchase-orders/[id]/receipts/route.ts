import { NextResponse } from "next/server";
import { dispatchTriggerOutcome } from "@/inngest/dispatch";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import { parseBody, route } from "@/lib/http";
import { recordGoodsReceipt } from "@/lib/procurement/receiving";
import { evaluateRestock } from "@/lib/procurement/trigger";
import { idSchema } from "@/lib/validation/common";
import { receiptSchema } from "@/lib/validation/orders";

/**
 * Catat penerimaan barang aktual (parsial/penuh). Stok bertambah hanya sebesar yang diterima; kelebihan dari outstanding
 * ditolak. Idempoten lewat idempotencyKey.
 */
export const POST = route(async (request: Request, ctx: RouteContext<"/api/purchase-orders/[id]/receipts">) => {
  const business = await requireBusinessForApi();
  const purchaseOrderId = idSchema.parse((await ctx.params).id);
  const body = await parseBody(request, receiptSchema);

  const receipt = await recordGoodsReceipt(prisma, { businessId: business.id, purchaseOrderId, ...body });

  // Stok berubah → evaluasi restock (idempoten; kunci = id penerimaan). Tidak diulang untuk permintaan duplikat.
  const trigger = receipt.duplicate
    ? null
    : await evaluateRestock(prisma, {
        businessId: business.id,
        evaluationKey: `receipt:${receipt.receiptId}`,
        expiryHours: getServerEnv().PROCUREMENT_REQUEST_EXPIRY_HOURS,
      });
  if (trigger) await dispatchTriggerOutcome(trigger, business.id);

  return NextResponse.json({ ...receipt, trigger }, { status: receipt.duplicate ? 200 : 201 });
});
