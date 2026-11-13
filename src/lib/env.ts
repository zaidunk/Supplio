import { z } from "zod";

/** String kosong di .env dianggap "tidak diisi" agar default Zod berlaku. */
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const optionalString = z.preprocess(blankToUndefined, z.string().min(1).optional());
const positiveInt = (fallback: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().positive().default(fallback));

/**
 * Variabel server. Yang dibutuhkan fase berikutnya (OpenAI, Telegram, Inngest) opsional di sini;
 * modul pemakainya wajib memanggil `requireEnv()` agar gagal jelas, bukan diam-diam.
 */
export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: optionalString,
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

  GEMINI_API_KEY: optionalString,
  /** Model Flash stabil; dapat diganti lewat env tanpa mengubah kode. */
  GEMINI_MODEL: z.preprocess(blankToUndefined, z.string().min(1).default("gemini-2.5-flash")),

  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_BOT_USERNAME: optionalString,
  TELEGRAM_WEBHOOK_SECRET: optionalString,
  /** Hanya untuk uji e2e (server Telegram palsu); produksi memakai default. */
  TELEGRAM_API_BASE_URL: z.preprocess(blankToUndefined, z.url().default("https://api.telegram.org")),

  INNGEST_EVENT_KEY: optionalString,
  INNGEST_SIGNING_KEY: optionalString,

  PROCUREMENT_REQUEST_EXPIRY_HOURS: positiveInt(24),
  SUPPLIER_RESPONSE_TIMEOUT_MINUTES: positiveInt(20),
  TELEGRAM_LINK_TOKEN_TTL_HOURS: positiveInt(48),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    // Hanya nama field + pesan; nilai (rahasia) tidak pernah ikut dicetak.
    const detail = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Konfigurasi environment tidak valid — ${detail}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

type OptionalKeys = {
  [K in keyof ServerEnv]-?: undefined extends ServerEnv[K] ? K : never;
}[keyof ServerEnv];

/** Ambil variabel opsional yang wajib ada untuk fitur tertentu. */
export function requireEnv<K extends OptionalKeys>(key: K): NonNullable<ServerEnv[K]> {
  const value = getServerEnv()[key];
  if (value === undefined || value === null) {
    throw new Error(`Environment variable ${String(key)} wajib diisi untuk fitur ini.`);
  }
  return value as NonNullable<ServerEnv[K]>;
}
