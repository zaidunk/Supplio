import { z } from "zod";

/** Kuantitas desimal positif, maksimal 3 desimal (sesuai DECIMAL(14,3)); diterima sebagai string/number lalu dinormalkan ke string. */
export const decimalQty = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, "Angka tidak valid (>= 0, maksimal 3 desimal)"));

/** Seperti decimalQty tetapi boleh bertanda (untuk ADJUSTMENT). */
export const signedDecimalQty = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(z.string().regex(/^-?\d{1,11}(\.\d{1,3})?$/, "Angka tidak valid (maksimal 3 desimal)"));

const MAX_IDR = 2_000_000_000; // batas kolom INTEGER

/** Nominal rupiah utuh > 0. */
export const idrPositive = z.number().int("Harus bilangan bulat rupiah").positive().max(MAX_IDR);
/** Nominal rupiah utuh >= 0 (mis. ongkir gratis). */
export const idrNonNegative = z.number().int("Harus bilangan bulat rupiah").min(0).max(MAX_IDR);

export const days = z.number().int().min(0).max(365);

export const idSchema = z.uuid();

/** Buang karakter kontrol (kecuali newline/tab) dan rapikan spasi; input pengguna yang masuk ke prompt harus bersih. */
export function sanitizeFreeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const hasDecimalsWithin = (value: string, scale: number): boolean =>
  (value.split(".")[1]?.length ?? 0) <= scale;
