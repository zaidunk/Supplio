import { NextResponse, type NextRequest } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { route } from "@/lib/http";
import { listPurchaseOrders } from "@/lib/procurement/receiving";

/** Daftar PO; `?outstanding=1` hanya yang belum diterima penuh. */
export const GET = route(async (request: NextRequest) => {
  const business = await requireBusinessForApi();
  const outstandingOnly = request.nextUrl.searchParams.get("outstanding") === "1";
  return NextResponse.json({ purchaseOrders: await listPurchaseOrders(prisma, business.id, { outstandingOnly }) });
});
