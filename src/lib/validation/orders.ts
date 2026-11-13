import { z } from "zod";
import { decimalQty, idSchema } from "./common";

const idempotencyKey = z.string().trim().min(8, "Kunci idempotensi minimal 8 karakter").max(100);

export const approveSchema = z
  .object({
    /** Rekomendasi yang dilihat pemilik; bila sudah diperbarui, approval ditolak (hindari menyetujui angka yang berbeda). */
    recommendationId: idSchema.optional(),
    idempotencyKey: idempotencyKey.optional(),
  })
  .strict();

export const rejectSchema = z.object({ reason: z.string().trim().max(200).optional() }).strict();

export const receiptSchema = z
  .object({
    items: z
      .array(z.object({ productId: idSchema, receivedQuantity: decimalQty }).strict())
      .min(1, "Isi minimal satu barang yang diterima")
      .max(100),
    /** Wajib: mengirim ulang permintaan yang sama tidak boleh menambah stok dua kali. */
    idempotencyKey,
    note: z.string().trim().max(300).optional(),
  })
  .strict();
