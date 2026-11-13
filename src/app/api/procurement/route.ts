import { NextResponse } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { route } from "@/lib/http";
import { listRequests } from "@/lib/procurement/queries";

export const GET = route(async () => {
  const business = await requireBusinessForApi();
  return NextResponse.json({ requests: await listRequests(prisma, business.id) });
});
