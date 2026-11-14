import type { PrismaClient } from "@/generated/prisma/client";
import type { Db } from "@/lib/db/types";
import { DomainError } from "@/lib/errors";
import type { SupplierProductInput } from "@/lib/validation/supplier";

export interface SupplierProductRow {
  productId: string;
  productName: string;
  unit: string;
  referenceUnitPrice: number;
  minimumOrderQuantity: string;
  packSize: string | null;
  referenceAvailableQuantity: string | null;
  referenceLeadTimeDays: number;
  referenceShippingFee: number | null;
  isPrimary: boolean;
}

export interface SupplierRow {
  id: string;
  name: string;
  isActive: boolean;
  /** Hanya status; telegramChatId/UserId tidak pernah dikirim ke klien. */
  telegramConnected: boolean;
  telegramVerifiedAt: string | null;
  /** Chat yang sudah menyetujui di Telegram dan menunggu konfirmasi owner. Id chat/user tidak dikirim ke klien. */
  telegramPending: { name: string | null; username: string | null; requestedAt: string } | null;
  products: SupplierProductRow[];
}

export async function listSuppliers(db: Db, businessId: string): Promise<SupplierRow[]> {
  const suppliers = await db.supplier.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      telegramVerifiedAt: true,
      telegramPendingChatId: true,
      telegramPendingName: true,
      telegramPendingUsername: true,
      telegramPendingAt: true,
      products: {
        select: {
          productId: true,
          referenceUnitPrice: true,
          minimumOrderQuantity: true,
          packSize: true,
          referenceAvailableQuantity: true,
          referenceLeadTimeDays: true,
          referenceShippingFee: true,
          isPrimary: true,
          product: { select: { name: true, unit: true } },
        },
      },
    },
  });

  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    isActive: s.isActive,
    telegramConnected: s.telegramVerifiedAt !== null,
    telegramVerifiedAt: s.telegramVerifiedAt?.toISOString() ?? null,
    telegramPending:
      s.telegramPendingChatId !== null && s.telegramPendingAt
        ? { name: s.telegramPendingName, username: s.telegramPendingUsername, requestedAt: s.telegramPendingAt.toISOString() }
        : null,
    products: s.products
      .map((p) => ({
        productId: p.productId,
        productName: p.product.name,
        unit: p.product.unit,
        referenceUnitPrice: p.referenceUnitPrice,
        minimumOrderQuantity: p.minimumOrderQuantity.toString(),
        packSize: p.packSize?.toString() ?? null,
        referenceAvailableQuantity: p.referenceAvailableQuantity?.toString() ?? null,
        referenceLeadTimeDays: p.referenceLeadTimeDays,
        referenceShippingFee: p.referenceShippingFee,
        isPrimary: p.isPrimary,
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName)),
  }));
}

/** Semua produk yang dirujuk harus milik bisnis ini (mencegah tautan lintas tenant). */
async function assertProductsOwned(tx: Db, businessId: string, productIds: string[]) {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return;
  const count = await tx.product.count({ where: { businessId, id: { in: unique } } });
  if (count !== unique.length) throw new DomainError("PRODUCT_NOT_FOUND", "Ada produk yang tidak ditemukan.", 400);
}

async function upsertSupplierProducts(tx: Db, businessId: string, supplierId: string, items: SupplierProductInput[]) {
  await assertProductsOwned(tx, businessId, items.map((i) => i.productId));

  for (const item of items) {
    const data = {
      referenceUnitPrice: item.referenceUnitPrice,
      minimumOrderQuantity: item.minimumOrderQuantity,
      packSize: item.packSize ?? null,
      referenceAvailableQuantity: item.referenceAvailableQuantity ?? null,
      referenceLeadTimeDays: item.referenceLeadTimeDays,
      referenceShippingFee: item.referenceShippingFee ?? null,
      isPrimary: item.isPrimary,
    };
    await tx.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId, productId: item.productId } },
      create: { supplierId, productId: item.productId, businessId, ...data },
      update: data,
    });
    // isPrimary berlaku per produk: hanya satu supplier utama per produk.
    if (item.isPrimary) {
      await tx.supplierProduct.updateMany({
        where: { businessId, productId: item.productId, supplierId: { not: supplierId }, isPrimary: true },
        data: { isPrimary: false },
      });
    }
  }
}

export async function createSupplier(
  db: PrismaClient,
  businessId: string,
  input: { name: string; products: SupplierProductInput[] },
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({ data: { businessId, name: input.name }, select: { id: true } });
    await upsertSupplierProducts(tx, businessId, supplier.id, input.products);
    return supplier;
  });
}

export async function updateSupplier(
  db: PrismaClient,
  businessId: string,
  supplierId: string,
  input: { name?: string; isActive?: boolean; products?: SupplierProductInput[]; removeProductIds?: string[] },
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const existing = await tx.supplier.findFirst({ where: { id: supplierId, businessId }, select: { id: true } });
    if (!existing) throw new DomainError("SUPPLIER_NOT_FOUND", "Supplier tidak ditemukan.", 404);

    if (input.name !== undefined || input.isActive !== undefined) {
      await tx.supplier.update({
        where: { id: supplierId },
        data: { name: input.name, isActive: input.isActive },
      });
    }
    if (input.removeProductIds?.length) {
      await tx.supplierProduct.deleteMany({
        where: { supplierId, businessId, productId: { in: input.removeProductIds } },
      });
    }
    if (input.products?.length) await upsertSupplierProducts(tx, businessId, supplierId, input.products);
    return { id: supplierId };
  });
}
