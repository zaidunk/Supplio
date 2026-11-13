import type { PrismaClient } from "@/generated/prisma/client";
import { isForeignKeyViolation, isUniqueViolation } from "@/lib/db/errors";
import { DomainError } from "@/lib/errors";
import { evaluateRestock, type EvaluateOutcome } from "@/lib/procurement/trigger";
import type { CreateProductInput, UpdateProductInput } from "@/lib/validation/product";

const nameTaken = () => new DomainError("PRODUCT_NAME_TAKEN", "Nama produk sudah dipakai.", 409);
const notFound = () => new DomainError("PRODUCT_NOT_FOUND", "Produk tidak ditemukan.", 404);

/** Buat produk; stok awal dicatat sebagai mutasi IN agar riwayat stok lengkap. Lalu evaluasi restock. */
export async function createProduct(
  db: PrismaClient,
  businessId: string,
  input: CreateProductInput,
  opts: { expiryHours: number },
): Promise<{ id: string; trigger: EvaluateOutcome }> {
  const { initialStock, ...fields } = input;

  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { businessId, ...fields, currentStock: initialStock },
        select: { id: true },
      });
      if (Number(initialStock) > 0) {
        await tx.inventoryMovement.create({
          data: { productId: created.id, type: "IN", quantity: initialStock, note: "Stok awal" },
        });
      }
      return created.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw nameTaken();
    throw e;
  }

  const trigger = await evaluateRestock(db, {
    businessId,
    evaluationKey: `product-created:${id}`,
    expiryHours: opts.expiryHours,
  });
  return { id, trigger };
}

/** Ubah konfigurasi produk (bukan stok). Perubahan konfigurasi memicu evaluasi restock (§4.1). */
export async function updateProduct(
  db: PrismaClient,
  businessId: string,
  productId: string,
  input: UpdateProductInput,
  opts: { expiryHours: number },
): Promise<{ id: string; trigger: EvaluateOutcome }> {
  const existing = await db.product.findFirst({ where: { id: productId, businessId }, select: { id: true } });
  if (!existing) throw notFound();

  let updatedAt: Date;
  try {
    const updated = await db.product.update({ where: { id: productId }, data: input, select: { updatedAt: true } });
    updatedAt = updated.updatedAt;
  } catch (e) {
    if (isUniqueViolation(e)) throw nameTaken();
    throw e;
  }

  const trigger = await evaluateRestock(db, {
    businessId,
    evaluationKey: `product:${productId}:${updatedAt.toISOString()}`,
    expiryHours: opts.expiryHours,
  });
  return { id: productId, trigger };
}

export async function deleteProduct(db: PrismaClient, businessId: string, productId: string): Promise<void> {
  const existing = await db.product.findFirst({ where: { id: productId, businessId }, select: { id: true } });
  if (!existing) throw notFound();
  try {
    await db.product.delete({ where: { id: productId } });
  } catch (e) {
    if (isForeignKeyViolation(e)) {
      throw new DomainError(
        "PRODUCT_IN_USE",
        "Produk masih dipakai oleh procurement request, penawaran, atau PO dan tidak bisa dihapus.",
        409,
      );
    }
    throw e;
  }
}
