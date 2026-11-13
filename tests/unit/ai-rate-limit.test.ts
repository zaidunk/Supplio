import { describe, expect, it } from "vitest";
import { classifyLlmError, parseRetryDelayMs } from "@/lib/ai/rate-limit";

// Potongan galat nyata dari Gemini Free Tier (disingkat).
const GEMINI_429 =
  "[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [429 Too Many Requests] You exceeded your current quota. * Quota exceeded for metric: generate_content_free_tier_requests, limit: 5. Please retry in 57.177235825s. [{\"@type\":\"type.googleapis.com/google.rpc.RetryInfo\",\"retryDelay\":\"57s\"}]";

describe("parseRetryDelayMs", () => {
  it("membaca petunjuk 'retry in Ns' (dibulatkan ke atas) dan 'retryDelay'", () => {
    expect(parseRetryDelayMs("Please retry in 57.177235825s.")).toBe(57_178);
    expect(parseRetryDelayMs('{"retryDelay":"57s"}')).toBe(57_000);
    expect(parseRetryDelayMs("Please retry in 2s")).toBe(2_000);
  });

  it("null bila tidak ada petunjuk", () => {
    expect(parseRetryDelayMs("kesalahan lain")).toBeNull();
  });
});

describe("classifyLlmError", () => {
  it("429 Gemini: RATE_LIMIT, menunggu sesuai petunjuk penyedia ditambah sedikit jeda", () => {
    const r = classifyLlmError(Object.assign(new Error(GEMINI_429), { name: "RateLimitQuotaExhaustedError" }));
    expect(r?.reason).toBe("RATE_LIMIT");
    expect(r!.retryAfterMs).toBeGreaterThanOrEqual(58_000);
    expect(r!.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("429 tanpa petunjuk: menunggu 1 menit; petunjuk ekstrem dibatasi 5 menit dan minimal 5 detik", () => {
    expect(classifyLlmError(new Error("429 Too Many Requests"))?.retryAfterMs).toBe(61_000);
    expect(classifyLlmError(new Error("429 retry in 3600s"))?.retryAfterMs).toBe(300_000);
    expect(classifyLlmError(new Error("429 retry in 0.5s"))?.retryAfterMs).toBe(5_000);
  });

  it("503/overloaded dan batas waktu model dianggap sementara (UNAVAILABLE)", () => {
    expect(classifyLlmError(new Error("[503 Service Unavailable] The model is overloaded"))).toEqual({ reason: "UNAVAILABLE", retryAfterMs: 15_000 });
    expect(classifyLlmError(new Error("Model tidak merespons dalam 60000 ms"))?.reason).toBe("UNAVAILABLE");
  });

  it("galat non-sementara (kode kita, validasi, 400) tidak diklasifikasikan agar tetap gagal jelas", () => {
    expect(classifyLlmError(new Error("[400 Bad Request] Invalid JSON payload"))).toBeNull();
    expect(classifyLlmError(new TypeError("Cannot read properties of undefined"))).toBeNull();
    expect(classifyLlmError("string biasa")).toBeNull();
  });
});
