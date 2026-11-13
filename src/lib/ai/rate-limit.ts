/**
 * Klasifikasi galat sementara dari penyedia LLM (Gemini). Kuota Free Tier sangat kecil (mis. 5 permintaan/menit/model),
 * jadi 429 adalah kejadian NORMAL yang harus ditunggu sesuai petunjuk penyedia, bukan diulang cepat-cepat.
 */
export interface TransientLlmError {
  /** Berapa lama sebaiknya menunggu sebelum mencoba lagi (ms). */
  retryAfterMs: number;
  reason: "RATE_LIMIT" | "UNAVAILABLE";
}

const MIN_WAIT_MS = 5_000;
const MAX_WAIT_MS = 5 * 60_000;
const DEFAULT_RATE_LIMIT_WAIT_MS = 60_000;
const DEFAULT_UNAVAILABLE_WAIT_MS = 15_000;

const clamp = (ms: number) => Math.min(MAX_WAIT_MS, Math.max(MIN_WAIT_MS, ms));

/** Baca petunjuk penyedia: "Please retry in 57.17s" atau `"retryDelay":"57s"`. Mengembalikan ms atau null. */
export function parseRetryDelayMs(message: string): number | null {
  const human = /retry in\s+(\d+(?:\.\d+)?)\s*s/i.exec(message);
  if (human) return Math.ceil(Number(human[1]) * 1000);
  const structured = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i.exec(message);
  if (structured) return Math.ceil(Number(structured[1]) * 1000);
  return null;
}

export function classifyLlmError(error: unknown): TransientLlmError | null {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);

  if (/\b429\b|too many requests|quota|rate.?limit|resource.?exhausted/i.test(message)) {
    const hinted = parseRetryDelayMs(message);
    return { reason: "RATE_LIMIT", retryAfterMs: clamp((hinted ?? DEFAULT_RATE_LIMIT_WAIT_MS) + 1_000) };
  }
  if (/\b50[023]\b|overloaded|unavailable|temporarily|deadline exceeded|model tidak merespons/i.test(message)) {
    return { reason: "UNAVAILABLE", retryAfterMs: DEFAULT_UNAVAILABLE_WAIT_MS };
  }
  return null;
}
