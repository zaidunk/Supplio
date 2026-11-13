import { NextResponse } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { route } from "@/lib/http";
import { getRequestDetail } from "@/lib/procurement/queries";
import { idSchema } from "@/lib/validation/common";

export const GET = route(async (_request: Request, ctx: RouteContext<"/api/procurement/[id]">) => {
  const business = await requireBusinessForApi();
  const id = idSchema.parse((await ctx.params).id);
  return NextResponse.json(await getRequestDetail(prisma, business.id, id));
});
