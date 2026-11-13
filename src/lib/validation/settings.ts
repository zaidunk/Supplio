import { z } from "zod";
import { idrNonNegative, sanitizeFreeText } from "./common";

export const businessSettingsSchema = z
  .object({
    /** Disalin ke restockBudget tiap request saat dibuat (snapshot). 0 = belum diatur. */
    defaultRestockBudget: idrNonNegative,
    responseTimeoutMinutes: z.number().int().min(1).max(1440),
  })
  .strict();

const styleText = (max: number) =>
  z
    .string()
    .max(max)
    .transform(sanitizeFreeText);

/** Hanya gaya komunikasi; tidak pernah memengaruhi aturan keamanan/keuangan (§3.2). */
export const aiSettingsSchema = z
  .object({
    communicationTone: styleText(200).pipe(z.string().min(1, "Wajib diisi")),
    negotiationStyle: styleText(200).pipe(z.string().min(1, "Wajib diisi")),
    customInstructions: styleText(1000),
  })
  .strict();
