import { NextResponse } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { route } from "@/lib/http";
import { sendOrderConfirmations } from "@/lib/procurement/orders";
import { getTelegramClient } from "@/lib/telegram/server";
import { idSchema } from "@/lib/validation/common";

/** Kirim ulang konfirmasi order untuk PO yang belum terkirim (mis. supplier baru terhubung). Idempoten. */
export const POST = route(async (_request: Request, ctx: RouteContext<"/api/purchase-orders/[id]/send">) => {
  const business = await requireBusinessForApi();
  const id = idSchema.parse((await ctx.params).id);
  const po = await prisma.purchaseOrder.findFirst({ where: { id, businessId: business.id }, select: { status: true } });
  if (!po) throw new DomainError("PO_NOT_FOUND", "Purchase order tidak ditemukan.", 404);

  const result = await sendOrderConfirmations(prisma, getTelegramClient(), { businessId: business.id, purchaseOrderId: id });
  return NextResponse.json(result);
});
