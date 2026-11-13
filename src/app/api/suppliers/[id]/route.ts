import { NextResponse } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { parseBody, route } from "@/lib/http";
import { updateSupplier } from "@/lib/suppliers/service";
import { idSchema } from "@/lib/validation/common";
import { updateSupplierSchema } from "@/lib/validation/supplier";

export const PATCH = route(async (request: Request, ctx: RouteContext<"/api/suppliers/[id]">) => {
  const business = await requireBusinessForApi();
  const id = idSchema.parse((await ctx.params).id);
  const input = await parseBody(request, updateSupplierSchema);
  return NextResponse.json(await updateSupplier(prisma, business.id, id, input));
});
