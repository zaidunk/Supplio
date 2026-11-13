import { NextResponse } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { route } from "@/lib/http";
import { listPurchaseOrders } from "@/lib/procurement/receiving";
import { idSchema } from "@/lib/validation/common";

export const GET = route(async (_request: Request, ctx: RouteContext<"/api/purchase-orders/[id]">) => {
  const business = await requireBusinessForApi();
  const id = idSchema.parse((await ctx.params).id);
  const [po] = await listPurchaseOrders(prisma, business.id, { id });
  if (!po) throw new DomainError("PO_NOT_FOUND", "Purchase order tidak ditemukan.", 404);
  return NextResponse.json(po);
});
