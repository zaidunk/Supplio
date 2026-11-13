import { NextResponse } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import { parseBody, route } from "@/lib/http";
import { createProduct } from "@/lib/inventory/products";
import { getInventoryOverview } from "@/lib/inventory/overview";
import { createProductSchema } from "@/lib/validation/product";

export const GET = route(async () => {
  const business = await requireBusinessForApi();
  const products = await getInventoryOverview(prisma, business.id);
  return NextResponse.json({ products });
});

export const POST = route(async (request: Request) => {
  const business = await requireBusinessForApi();
  const input = await parseBody(request, createProductSchema);
  const result = await createProduct(prisma, business.id, input, {
    expiryHours: getServerEnv().PROCUREMENT_REQUEST_EXPIRY_HOURS,
  });
  return NextResponse.json(result, { status: 201 });
});
