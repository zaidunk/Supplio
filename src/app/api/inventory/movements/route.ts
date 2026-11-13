import { NextResponse } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import { parseBody, route } from "@/lib/http";
import { recordMovement } from "@/lib/inventory/movements";
import { movementSchema } from "@/lib/validation/product";

/** Mutasi stok → evaluasi threshold → trigger restock otomatis & idempotent (§4.1, §10). */
export const POST = route(async (request: Request) => {
  const business = await requireBusinessForApi();
  const input = await parseBody(request, movementSchema);
  const result = await recordMovement(
    prisma,
    { businessId: business.id, ...input },
    { expiryHours: getServerEnv().PROCUREMENT_REQUEST_EXPIRY_HOURS },
  );
  // 200 untuk replay idempotent, 201 untuk mutasi baru.
  return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
});
