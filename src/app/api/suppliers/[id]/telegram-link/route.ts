import { NextResponse } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import { DomainError } from "@/lib/errors";
import { route } from "@/lib/http";
import { createLinkToken } from "@/lib/telegram/onboarding";
import { idSchema } from "@/lib/validation/common";

/** Buat tautan onboarding Telegram sekali pakai untuk supplier milik bisnis ini. Tautan tidak di-log. */
export const POST = route(async (_request: Request, ctx: RouteContext<"/api/suppliers/[id]/telegram-link">) => {
  const business = await requireBusinessForApi();
  const supplierId = idSchema.parse((await ctx.params).id);

  const env = getServerEnv();
  if (!env.TELEGRAM_BOT_USERNAME) {
    throw new DomainError("TELEGRAM_NOT_CONFIGURED", "Bot Telegram belum dikonfigurasi (TELEGRAM_BOT_USERNAME).", 503);
  }

  const { url, expiresAt } = await createLinkToken(prisma, {
    businessId: business.id,
    supplierId,
    botUsername: env.TELEGRAM_BOT_USERNAME,
    ttlHours: env.TELEGRAM_LINK_TOKEN_TTL_HOURS,
  });
  return NextResponse.json({ url, expiresAt: expiresAt.toISOString() }, { status: 201, headers: { "Cache-Control": "no-store" } });
});
