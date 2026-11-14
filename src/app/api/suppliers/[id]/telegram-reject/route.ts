import { NextResponse } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { route } from "@/lib/http";
import { rejectTelegramLink } from "@/lib/telegram/onboarding";
import { getTelegramClient } from "@/lib/telegram/server";
import { idSchema } from "@/lib/validation/common";

/** Owner menolak chat Telegram yang menunggu konfirmasi: chat dilepas dan tidak pernah terverifikasi. */
export const POST = route(async (_request: Request, ctx: RouteContext<"/api/suppliers/[id]/telegram-reject">) => {
  const business = await requireBusinessForApi();
  const supplierId = idSchema.parse((await ctx.params).id);

  await rejectTelegramLink(prisma, getTelegramClient(), { businessId: business.id, supplierId });
  return NextResponse.json({ status: "REJECTED" });
});
