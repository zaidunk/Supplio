import "server-only";
import { getServerEnv, requireEnv } from "@/lib/env";
import { createTelegramClient, type TelegramClient } from "./client";

/** Klien Telegram untuk server Next.js; token dari env, tidak pernah ke browser. */
export function getTelegramClient(): TelegramClient {
  return createTelegramClient({
    token: requireEnv("TELEGRAM_BOT_TOKEN"),
    baseUrl: getServerEnv().TELEGRAM_API_BASE_URL,
  });
}
