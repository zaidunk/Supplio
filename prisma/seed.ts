/**
 * Seed DEMO — SELURUH DATA DI SINI ADALAH SIMULASI (bukan harga/stok/supplier nyata).
 * Nama bisnis dan supplier diberi label "(seed)" agar tidak tertukar dengan data asli.
 * Harga dan stok supplier SESUNGGUHNYA harus datang dari percakapan Telegram dengan manusia (SUPPLIO.md §15).
 *
 * Jalankan: npm run db:seed   (butuh SEED_OWNER_USER_ID = UUID user di Supabase Auth)
 * Idempotent: aman dijalankan berulang.
 */
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local" });
loadEnv();

const ownerUserId = process.env.SEED_OWNER_USER_ID?.trim();
const connectionString = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
if (!ownerUserId) throw new Error("SEED_OWNER_USER_ID wajib diisi (UUID user Supabase Auth).");
if (!connectionString) throw new Error("DATABASE_URL/DIRECT_URL wajib diisi.");
const ownerId: string = ownerUserId;

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type ProductSeed = {
  name: string;
  unit: string;
  quantityScale: number;
  currentStock: string;
  lastPurchaseUnitPrice: number;
  dailyConsumption: string;
  manualThreshold: string;
  plannedLeadTimeDays: number;
  safetyStock: string;
  targetCoverageDays: number;
  maximumUnitPrice?: number;
};

const PRODUCTS: ProductSeed[] = [
  { name: "Bawang Putih", unit: "kg", quantityScale: 1, currentStock: "12", lastPurchaseUnitPrice: 38000, dailyConsumption: "5", manualThreshold: "10", plannedLeadTimeDays: 2, safetyStock: "5", targetCoverageDays: 5, maximumUnitPrice: 45000 },
  { name: "Telur Ayam", unit: "kg", quantityScale: 1, currentStock: "60", lastPurchaseUnitPrice: 29000, dailyConsumption: "20", manualThreshold: "30", plannedLeadTimeDays: 1, safetyStock: "10", targetCoverageDays: 4, maximumUnitPrice: 33000 },
  { name: "Minyak Goreng", unit: "liter", quantityScale: 0, currentStock: "20", lastPurchaseUnitPrice: 17500, dailyConsumption: "8", manualThreshold: "15", plannedLeadTimeDays: 2, safetyStock: "8", targetCoverageDays: 6, maximumUnitPrice: 20000 },
  { name: "Tepung Terigu", unit: "kg", quantityScale: 1, currentStock: "40", lastPurchaseUnitPrice: 12000, dailyConsumption: "10", manualThreshold: "25", plannedLeadTimeDays: 3, safetyStock: "10", targetCoverageDays: 7 },
  { name: "Gula Pasir", unit: "kg", quantityScale: 1, currentStock: "8", lastPurchaseUnitPrice: 16500, dailyConsumption: "4", manualThreshold: "10", plannedLeadTimeDays: 2, safetyStock: "5", targetCoverageDays: 7 },
];

type SupplierSeed = {
  name: string;
  /** productName -> data referensi (SIMULASI) */
  products: Record<string, { price: number; moq: string; pack?: string; stock?: string; lead: number; shipping: number; primary?: boolean }>;
};

const SUPPLIERS: SupplierSeed[] = [
  {
    name: "Supplier A (seed)",
    products: {
      "Bawang Putih": { price: 39000, moq: "5", lead: 1, shipping: 15000, primary: true },
      "Telur Ayam": { price: 29500, moq: "10", lead: 1, shipping: 15000, primary: true },
      "Minyak Goreng": { price: 18000, moq: "12", pack: "12", lead: 2, shipping: 15000 },
    },
  },
  {
    name: "Supplier B (seed)",
    products: {
      "Bawang Putih": { price: 37500, moq: "10", lead: 2, shipping: 25000 },
      "Minyak Goreng": { price: 17200, moq: "24", pack: "12", lead: 2, shipping: 25000, primary: true },
      "Tepung Terigu": { price: 11800, moq: "25", pack: "25", lead: 3, shipping: 25000, primary: true },
      "Gula Pasir": { price: 16200, moq: "10", lead: 2, shipping: 25000, primary: true },
    },
  },
  {
    name: "Supplier C (seed)",
    products: {
      "Telur Ayam": { price: 28800, moq: "20", lead: 2, shipping: 20000 },
      "Tepung Terigu": { price: 12200, moq: "10", lead: 1, shipping: 20000 },
      "Gula Pasir": { price: 16800, moq: "5", lead: 1, shipping: 20000 },
    },
  },
];

async function main() {
  const business = await prisma.business.upsert({
    where: { ownerUserId: ownerId },
    create: { ownerUserId: ownerId, name: "UMKM Demo (seed/simulasi)", defaultRestockBudget: 5_000_000 },
    update: {},
  });
  await prisma.aISettings.createMany({
    data: [{ businessId: business.id, version: 1 }],
    skipDuplicates: true,
  });

  const productIds = new Map<string, string>();
  for (const p of PRODUCTS) {
    const { name, ...data } = p;
    const product = await prisma.product.upsert({
      where: { businessId_name: { businessId: business.id, name } },
      create: { businessId: business.id, name, ...data },
      update: {},
    });
    productIds.set(name, product.id);
  }

  for (const s of SUPPLIERS) {
    const supplier =
      (await prisma.supplier.findFirst({ where: { businessId: business.id, name: s.name } })) ??
      (await prisma.supplier.create({ data: { businessId: business.id, name: s.name } }));

    for (const [productName, d] of Object.entries(s.products)) {
      const productId = productIds.get(productName);
      if (!productId) throw new Error(`Produk seed tidak dikenal: ${productName}`);
      const data = {
        referenceUnitPrice: d.price,
        minimumOrderQuantity: d.moq,
        packSize: d.pack ?? null,
        referenceAvailableQuantity: d.stock ?? null,
        referenceLeadTimeDays: d.lead,
        referenceShippingFee: d.shipping,
        isPrimary: d.primary ?? false,
      };
      await prisma.supplierProduct.upsert({
        where: { supplierId_productId: { supplierId: supplier.id, productId } },
        create: { supplierId: supplier.id, productId, businessId: business.id, ...data },
        update: {},
      });
    }
  }

  console.log(
    `Seed selesai: bisnis "${business.name}", ${PRODUCTS.length} produk, ${SUPPLIERS.length} supplier (data simulasi).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
