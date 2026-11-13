import { z } from "zod";
import { days, decimalQty, hasDecimalsWithin, idrPositive, idSchema, signedDecimalQty } from "./common";

const planningFields = {
  lastPurchaseUnitPrice: idrPositive.nullable().optional(),
  dailyConsumption: decimalQty.nullable().optional(),
  manualThreshold: decimalQty.optional(),
  plannedLeadTimeDays: days.nullable().optional(),
  safetyStock: decimalQty.optional(),
  targetCoverageDays: days.nullable().optional(),
  maximumUnitPrice: idrPositive.nullable().optional(),
  allowedOverbuyQuantity: decimalQty.optional(),
};

const nameField = z.string().trim().min(1, "Nama wajib diisi").max(120);

export const createProductSchema = z
  .object({
    name: nameField,
    unit: z.string().trim().min(1, "Satuan wajib diisi").max(20),
    quantityScale: z.number().int().min(0).max(3).default(0),
    initialStock: decimalQty.default("0"),
    ...planningFields,
  })
  .strict()
  .superRefine((p, ctx) => {
    if (!hasDecimalsWithin(p.initialStock, p.quantityScale)) {
      ctx.addIssue({ code: "custom", path: ["initialStock"], message: `Satuan ini hanya mengizinkan ${p.quantityScale} desimal` });
    }
  });

/**
 * Stok TIDAK bisa diubah lewat PATCH (hanya lewat mutasi stok bersejarah), dan satuan/presisi bersifat tetap.
 */
export const updateProductSchema = z
  .object({ name: nameField.optional(), ...planningFields })
  .strict()
  .refine((p) => Object.keys(p).length > 0, "Tidak ada perubahan");

export const movementSchema = z
  .object({
    productId: idSchema,
    type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
    quantity: signedDecimalQty,
    note: z.string().trim().max(300).optional(),
    idempotencyKey: z.string().trim().min(8).max(100).optional(),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (m.type !== "ADJUSTMENT" && m.quantity.startsWith("-")) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Kuantitas IN/OUT harus positif" });
    }
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
