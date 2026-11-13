import { NextResponse } from "next/server";
import { dispatchTriggerOutcome } from "@/inngest/dispatch";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import { parseBody, route } from "@/lib/http";
import { getBusinessSettings, updateBusinessSettings } from "@/lib/settings/service";
import { businessSettingsSchema } from "@/lib/validation/settings";

export const GET = route(async () => {
  const business = await requireBusinessForApi();
  const settings = await getBusinessSettings(prisma, business.id);
  return NextResponse.json({
    ...settings,
    requestExpiryHours: getServerEnv().PROCUREMENT_REQUEST_EXPIRY_HOURS, // dari env, hanya-baca
  });
});

export const PUT = route(async (request: Request) => {
  const business = await requireBusinessForApi();
  const input = await parseBody(request, businessSettingsSchema);
  const result = await updateBusinessSettings(prisma, business.id, input, {
    expiryHours: getServerEnv().PROCUREMENT_REQUEST_EXPIRY_HOURS,
  });
  await dispatchTriggerOutcome(result.trigger, business.id);
  return NextResponse.json(result);
});
