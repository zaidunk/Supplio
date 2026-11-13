import { z } from "zod";
import { days, decimalQty, idrNonNegative, idrPositive, idSchema } from "./common";

export const supplierProductSchema = z
  .object({
    productId: idSchema,
    referenceUnitPrice: idrPositive,
    minimumOrderQuantity: decimalQty.default("1"),
    packSize: decimalQty.nullable().optional(),
    referenceAvailableQuantity: decimalQty.nullable().optional(),
    referenceLeadTimeDays: days,
    referenceShippingFee: idrNonNegative.nullable().optional(),
    isPrimary: z.boolean().default(false),
  })
  .strict();

const nameField = z.string().trim().min(1, "Nama wajib diisi").max(120);

export const createSupplierSchema = z
  .object({
    name: nameField,
    products: z.array(supplierProductSchema).max(200).default([]),
  })
  .strict();

export const updateSupplierSchema = z
  .object({
    name: nameField.optional(),
    isActive: z.boolean().optional(),
    /** Upsert harga/MOQ/lead time referensi per produk. */
    products: z.array(supplierProductSchema).max(200).optional(),
    removeProductIds: z.array(idSchema).max(200).optional(),
  })
  .strict()
  .refine((s) => Object.keys(s).length > 0, "Tidak ada perubahan");

export type SupplierProductInput = z.infer<typeof supplierProductSchema>;
