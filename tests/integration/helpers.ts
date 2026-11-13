import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

loadEnv({ path: ".env.local", quiet: true });

/**
 * Integration test memakai database sungguhan (DATABASE_URL). Aman karena setiap tes membuat BISNIS UJI
 * terisolasi (ownerUserId berawalan "itest-") dan menghapus seluruh datanya sesudahnya; data demo tidak disentuh.
 */
export const RUN_DB_TESTS = process.env.RUN_DB_TESTS === "1";

let client: PrismaClient | undefined;
export function db(): PrismaClient {
  client ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 10 }),
  });
  return client;
}

export async function createTestBusiness(overrides: { defaultRestockBudget?: number } = {}) {
  const prisma = db();
  const business = await prisma.business.create({
    data: {
      ownerUserId: `itest-${randomUUID()}`,
      name: "Bisnis Uji Integrasi",
      defaultRestockBudget: overrides.defaultRestockBudget ?? 1_000_000,
    },
  });
  await prisma.aISettings.create({ data: { businessId: business.id, version: 1 } });
  return business;
}

/** Konfigurasi seperti seed Bawang Putih: ROP = max(10, 5*2+5) = 15, target = 5*(2+5)+5 = 40. */
export async function createTestProduct(
  businessId: string,
  overrides: Partial<{
    name: string;
    unit: string;
    quantityScale: number;
    currentStock: string;
    dailyConsumption: string | null;
    plannedLeadTimeDays: number | null;
    targetCoverageDays: number | null;
  }> = {},
) {
  return db().product.create({
    data: {
      businessId,
      name: overrides.name ?? `Produk ${randomUUID().slice(0, 8)}`,
      unit: overrides.unit ?? "kg",
      quantityScale: overrides.quantityScale ?? 1,
      currentStock: overrides.currentStock ?? "20",
      dailyConsumption: overrides.dailyConsumption === undefined ? "5" : overrides.dailyConsumption,
      manualThreshold: "10",
      plannedLeadTimeDays: overrides.plannedLeadTimeDays === undefined ? 2 : overrides.plannedLeadTimeDays,
      safetyStock: "5",
      targetCoverageDays: overrides.targetCoverageDays === undefined ? 5 : overrides.targetCoverageDays,
    },
  });
}

/** Supplier aktif yang menyuplai produk (syarat agar produk boleh dipicu restock). */
export async function linkSupplier(businessId: string, productId: string, name = "Supplier Uji") {
  const prisma = db();
  const supplier =
    (await prisma.supplier.findFirst({ where: { businessId, name } })) ??
    (await prisma.supplier.create({ data: { businessId, name } }));
  await prisma.supplierProduct.create({
    data: { supplierId: supplier.id, productId, businessId, referenceUnitPrice: 10_000, referenceLeadTimeDays: 1 },
  });
  return supplier;
}

/** Hapus seluruh data bisnis uji dengan urutan yang menghormati FK RESTRICT. */
export async function cleanupBusiness(businessId: string) {
  const prisma = db();
  await prisma.goodsReceipt.deleteMany({ where: { purchaseOrder: { businessId } } });
  await prisma.purchaseOrder.deleteMany({ where: { businessId } });
  await prisma.procurementRequest.deleteMany({ where: { businessId } });
  await prisma.business.deleteMany({ where: { id: businessId } });
}
