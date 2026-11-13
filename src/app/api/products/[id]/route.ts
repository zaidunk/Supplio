import { NextResponse } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import { parseBody, route } from "@/lib/http";
import { deleteProduct, updateProduct } from "@/lib/inventory/products";
import { idSchema } from "@/lib/validation/common";
import { updateProductSchema } from "@/lib/validation/product";

export const PATCH = route(async (request: Request, ctx: RouteContext<"/api/products/[id]">) => {
  const business = await requireBusinessForApi();
  const id = idSchema.parse((await ctx.params).id);
  const input = await parseBody(request, updateProductSchema);
  const result = await updateProduct(prisma, business.id, id, input, {
    expiryHours: getServerEnv().PROCUREMENT_REQUEST_EXPIRY_HOURS,
  });
  return NextResponse.json(result);
});

export const DELETE = route(async (_request: Request, ctx: RouteContext<"/api/products/[id]">) => {
  const business = await requireBusinessForApi();
  const id = idSchema.parse((await ctx.params).id);
  await deleteProduct(prisma, business.id, id);
  return new NextResponse(null, { status: 204 });
});
