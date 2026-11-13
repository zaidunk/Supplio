/**
 * Klien Telegram Bot API via HTTPS (SUPPLIO.md §5). Bukan akun personal/MTProto.
 *
 * - Token tidak pernah masuk ke pesan galat, log, atau objek hasil (hanya nama metode).
 * - 429 menghormati `retry_after`; 5xx dan galat jaringan di-retry dengan backoff; 4xx lain langsung gagal.
 * - `fetch` dan `sleep` dapat disuntik agar perilaku retry bisa diuji tanpa jaringan.
 */
export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface SendMessageArgs {
  chatId: number;
  text: string;
  inlineKeyboard?: InlineKeyboardButton[][];
}

export interface TelegramClient {
  sendMessage(args: SendMessageArgs): Promise<{ messageId: number }>;
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
}

export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly httpStatus: number | null,
    readonly description: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(`Telegram ${method} gagal${httpStatus ? ` (${httpStatus})` : ""}: ${description}`);
    this.name = "TelegramApiError";
  }

  /** Bot diblokir pengguna / chat tidak dapat dihubungi: tidak ada gunanya di-retry. */
  get isBlockedOrGone(): boolean {
    return this.httpStatus === 403 || (this.httpStatus === 400 && /chat not found/i.test(this.description));
  }
}

export interface TelegramClientOptions {
  token: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
}

const MAX_RETRY_AFTER_MS = 30_000;
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createTelegramClient(options: TelegramClientOptions): TelegramClient {
  const { token } = options;
  const baseUrl = (options.baseUrl ?? "https://api.telegram.org").replace(/\/+$/, "");
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const maxAttempts = options.maxAttempts ?? 3;

  async function call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    let lastError: TelegramApiError | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let res: Response;
      try {
        res = await doFetch(`${baseUrl}/bot${token}/${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // Pesan galat fetch bisa memuat URL (dan token): jangan diteruskan.
        lastError = new TelegramApiError(method, null, "galat jaringan");
        if (attempt < maxAttempts) await sleep(backoff(attempt));
        continue;
      }

      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        result?: T;
        description?: string;
        parameters?: { retry_after?: number };
      } | null;

      if (res.ok && body?.ok) return body.result as T;

      const description = body?.description ?? `HTTP ${res.status}`;
      const retryAfter = body?.parameters?.retry_after;
      lastError = new TelegramApiError(method, res.status, description, retryAfter);

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === maxAttempts) throw lastError;
      await sleep(res.status === 429 && retryAfter ? Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS) : backoff(attempt));
    }
    throw lastError ?? new TelegramApiError(method, null, "gagal tanpa respons");
  }

  return {
    async sendMessage({ chatId, text, inlineKeyboard }) {
      const result = await call<{ message_id: number }>("sendMessage", {
        chat_id: chatId,
        text,
        ...(inlineKeyboard ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {}),
      });
      return { messageId: result.message_id };
    },
    async answerCallbackQuery(callbackQueryId, text) {
      await call<boolean>("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
    },
  };
}

const backoff = (attempt: number) => 500 * 3 ** (attempt - 1);
