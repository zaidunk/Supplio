import { NextResponse } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { parseBody, route } from "@/lib/http";
import { getActiveAiSettings, saveAiSettings } from "@/lib/settings/service";
import { aiSettingsSchema } from "@/lib/validation/settings";

export const GET = route(async () => {
  const business = await requireBusinessForApi();
  return NextResponse.json(await getActiveAiSettings(prisma, business.id));
});

export const PUT = route(async (request: Request) => {
  const business = await requireBusinessForApi();
  const input = await parseBody(request, aiSettingsSchema);
  return NextResponse.json(await saveAiSettings(prisma, business.id, input));
});
