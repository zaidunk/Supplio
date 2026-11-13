import { NextResponse } from "next/server";
import { dispatchTriggerOutcome } from "@/inngest/dispatch";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import { parseBody, route } from "@/lib/http";
import { listRequests } from "@/lib/procurement/queries";
import { createManualRequest } from "@/lib/procurement/trigger";
import { manualRequestSchema } from "@/lib/validation/procurement";

export const GET = route(async () => {
  const business = await requireBusinessForApi();
  return NextResponse.json({ requests: await listRequests(prisma, business.id) });
});

/** Owner meminta penawaran manual untuk barang pilihannya, tanpa menunggu ambang restock (§4.1). */
export const POST = route(async (request: Request) => {
  const business = await requireBusinessForApi();
  const input = await parseBody(request, manualRequestSchema);
  const result = await createManualRequest(prisma, {
    businessId: business.id,
    ...input,
    expiryHours: getServerEnv().PROCUREMENT_REQUEST_EXPIRY_HOURS,
  });
  await dispatchTriggerOutcome(result, business.id);
  // 200 untuk replay idempotent, 201 untuk request baru.
  return NextResponse.json({ requestId: result.requestId }, { status: result.outcome === "EXISTING" ? 200 : 201 });
});
