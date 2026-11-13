import { NextResponse } from "next/server";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { parseBody, route } from "@/lib/http";
import { createSupplier, listSuppliers } from "@/lib/suppliers/service";
import { createSupplierSchema } from "@/lib/validation/supplier";

export const GET = route(async () => {
  const business = await requireBusinessForApi();
  return NextResponse.json({ suppliers: await listSuppliers(prisma, business.id) });
});

export const POST = route(async (request: Request) => {
  const business = await requireBusinessForApi();
  const input = await parseBody(request, createSupplierSchema);
  const supplier = await createSupplier(prisma, business.id, input);
  return NextResponse.json(supplier, { status: 201 });
});
