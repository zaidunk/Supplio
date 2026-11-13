import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
};

describe("parseServerEnv", () => {
  it("memakai default 24 jam dan 20 menit bila kosong", () => {
    const env = parseServerEnv({
      ...base,
      PROCUREMENT_REQUEST_EXPIRY_HOURS: "",
      SUPPLIER_RESPONSE_TIMEOUT_MINUTES: undefined,
    });
    expect(env.PROCUREMENT_REQUEST_EXPIRY_HOURS).toBe(24);
    expect(env.SUPPLIER_RESPONSE_TIMEOUT_MINUTES).toBe(20);
  });

  it("membaca override dari env", () => {
    const env = parseServerEnv({ ...base, PROCUREMENT_REQUEST_EXPIRY_HOURS: "48" });
    expect(env.PROCUREMENT_REQUEST_EXPIRY_HOURS).toBe(48);
  });

  it("menganggap string kosong pada variabel opsional sebagai tidak diisi", () => {
    const env = parseServerEnv({ ...base, OPENAI_API_KEY: "", TELEGRAM_BOT_TOKEN: "  " });
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
  });

  it("menolak nilai tidak valid tanpa membocorkan nilainya", () => {
    const secret = "super-secret-value";
    expect(() => parseServerEnv({ ...base, PROCUREMENT_REQUEST_EXPIRY_HOURS: "-3", DATABASE_URL: "" })).toThrow(
      /DATABASE_URL/,
    );
    try {
      parseServerEnv({ ...base, NEXT_PUBLIC_SUPABASE_URL: secret });
    } catch (e) {
      expect(String(e)).not.toContain(secret);
    }
  });
});
