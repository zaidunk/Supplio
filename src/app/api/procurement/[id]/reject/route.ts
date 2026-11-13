import { NextResponse } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { parseBody, route } from "@/lib/http";
import { rejectRequest } from "@/lib/procurement/approval";
import { idSchema } from "@/lib/validation/common";
import { rejectSchema } from "@/lib/validation/orders";

/** Reject/Cancel oleh owner. Hanya sebelum dipesan; idempoten. */
export const POST = route(async (request: Request, ctx: RouteContext<"/api/procurement/[id]/reject">) => {
  const business = await requireBusinessForApi();
  const requestId = idSchema.parse((await ctx.params).id);
  const { reason } = await parseBody(request, rejectSchema);
  const result = await rejectRequest(prisma, { businessId: business.id, requestId, reason });
  return NextResponse.json({ status: "CANCELLED", ...result });
});
