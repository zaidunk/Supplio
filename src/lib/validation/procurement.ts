import { z } from "zod";
import { days, decimalQty, idSchema } from "./common";

/** Permintaan penawaran manual oleh owner dari Inventory (SUPPLIO.md §4.1). */
export const manualRequestSchema = z
  .object({
    clientKey: z.string().trim().min(8).max(100),
    items: z
      .array(
        z
          .object({
            productId: idSchema,
            quantity: decimalQty,
            maxDeliveryDays: days.optional(),
          })
          .strict(),
      )
      .min(1, "Pilih minimal satu barang")
      .max(50),
  })
  .strict();

export type ManualRequestBody = z.infer<typeof manualRequestSchema>;
