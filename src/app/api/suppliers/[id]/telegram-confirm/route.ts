import { NextResponse } from "next/server";
import { dispatchEvents } from "@/inngest/dispatch";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { route } from "@/lib/http";
import { confirmTelegramLink } from "@/lib/telegram/onboarding";
import { getTelegramClient } from "@/lib/telegram/server";
import { idSchema } from "@/lib/validation/common";

/**
 * Owner mengonfirmasi chat Telegram yang menunggu: baru setelah ini supplier terverifikasi dan request DRAFT yang
 * menunggu supplier terjangkau dilanjutkan (`supplier/telegram.connected`).
 */
export const POST = route(async (_request: Request, ctx: RouteContext<"/api/suppliers/[id]/telegram-confirm">) => {
  const business = await requireBusinessForApi();
  const supplierId = idSchema.parse((await ctx.params).id);

  const { verifiedAt } = await confirmTelegramLink(prisma, getTelegramClient(), { businessId: business.id, supplierId });
  await dispatchEvents([
    {
      id: `connected-${supplierId}-${verifiedAt.getTime()}`,
      name: "supplier/telegram.connected",
      data: { supplierId, businessId: business.id },
    },
  ]);
  return NextResponse.json({ status: "CONNECTED" });
});
