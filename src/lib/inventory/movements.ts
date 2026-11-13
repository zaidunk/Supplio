import Decimal from "decimal.js";
import type { MovementType, PrismaClient } from "@/generated/prisma/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { DomainError } from "@/lib/errors";
import { evaluateRestock, type EvaluateOutcome } from "@/lib/procurement/trigger";

export interface MovementInput {
  businessId: string;
  productId: string;
  type: MovementType;
  /** Desimal sebagai string. IN/OUT: positif. ADJUSTMENT: bertanda (+ menambah, - mengurangi). */
  quantity: string;
  note?: string | null;
  referenceId?: string | null;
  /** Dari klien; di-namespace per bisnis sebelum disimpan agar tidak bentrok antar tenant. */
  idempotencyKey?: string | null;
}

export interface MovementResult {
  movementId: string;
  duplicate: boolean;
  currentStock: string;
}

/**
 * Catat mutasi stok + ubah currentStock dalam SATU transaksi.
 * - Pengurangan memakai UPDATE bersyarat (`currentStock >= jumlah`) sehingga stok tidak pernah negatif
 *   walau ada dua OUT paralel.
 * - Idempotensi: kunci yang sama mengembalikan mutasi pertama tanpa menerapkan ulang.
 */
export async function applyStockMovement(db: PrismaClient, input: MovementInput): Promise<MovementResult> {
  const key = input.idempotencyKey ? `${input.businessId}:${input.idempotencyKey}` : null;

  try {
    return await db.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: input.productId, businessId: input.businessId },
        select: { quantityScale: true },
      });
      if (!product) throw new DomainError("PRODUCT_NOT_FOUND", "Produk tidak ditemukan.", 404);

      const qty = new Decimal(input.quantity);
      if (!qty.isFinite()) throw new DomainError("INVALID_QUANTITY", "Kuantitas tidak valid.");
      if (input.type === "ADJUSTMENT" ? qty.isZero() : qty.lte(0)) {
        throw new DomainError(
          "INVALID_QUANTITY",
          input.type === "ADJUSTMENT" ? "Penyesuaian tidak boleh 0." : "Kuantitas harus lebih dari 0.",
        );
      }
      if (qty.decimalPlaces() > product.quantityScale) {
        throw new DomainError(
          "QUANTITY_SCALE_EXCEEDED",
          `Satuan produk ini hanya mengizinkan ${product.quantityScale} angka desimal.`,
        );
      }

      const delta = input.type === "OUT" ? qty.neg() : qty;

      const movement = await tx.inventoryMovement.create({
        data: {
          productId: input.productId,
          type: input.type,
          quantity: qty.toString(),
          note: input.note ?? null,
          referenceId: input.referenceId ?? null,
          idempotencyKey: key,
        },
        select: { id: true },
      });

      if (delta.isNegative()) {
        const amount = delta.abs().toString();
        const updated = await tx.product.updateMany({
          where: { id: input.productId, businessId: input.businessId, currentStock: { gte: amount } },
          data: { currentStock: { decrement: amount } },
        });
        if (updated.count === 0) throw new DomainError("INSUFFICIENT_STOCK", "Stok tidak mencukupi.", 409);
      } else {
        await tx.product.update({ where: { id: input.productId }, data: { currentStock: { increment: delta.toString() } } });
      }

      const after = await tx.product.findUniqueOrThrow({
        where: { id: input.productId },
        select: { currentStock: true },
      });
      return { movementId: movement.id, duplicate: false, currentStock: after.currentStock.toString() };
    });
  } catch (e) {
    if (key && isUniqueViolation(e)) {
      const existing = await db.inventoryMovement.findUnique({
        where: { idempotencyKey: key },
        select: { id: true, product: { select: { currentStock: true } } },
      });
      if (existing) {
        return { movementId: existing.id, duplicate: true, currentStock: existing.product.currentStock.toString() };
      }
    }
    throw e;
  }
}

/**
 * Mutasi stok lalu evaluasi restock. Evaluasi memakai id movement sebagai kunci peristiwa, jadi
 * mengirim ulang request dengan idempotencyKey sama menghasilkan request restock yang sama (bukan ganda).
 */
export async function recordMovement(
  db: PrismaClient,
  input: MovementInput,
  opts: { expiryHours: number },
): Promise<MovementResult & { trigger: EvaluateOutcome }> {
  const result = await applyStockMovement(db, input);
  const trigger = await evaluateRestock(db, {
    businessId: input.businessId,
    evaluationKey: `movement:${result.movementId}`,
    expiryHours: opts.expiryHours,
  });
  return { ...result, trigger };
}
