/**
 * Kelola webhook bot Telegram (SUPPLIO.md §5). Token dan secret dibaca dari .env.local dan TIDAK dicetak.
 *
 *   npm run telegram:webhook -- info
 *   npm run telegram:webhook -- set https://domain-publik-anda.example     (wajib HTTPS publik)
 *   npm run telegram:webhook -- delete
 *
 * Untuk dev lokal, ekspos localhost lewat tunnel HTTPS (mis. cloudflared/ngrok) dan pakai URL tunnel itu.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const WEBHOOK_PATH = "/api/telegram/webhook";
const [command, argument] = process.argv.slice(2);

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const apiBase = (process.env.TELEGRAM_API_BASE_URL?.trim() || "https://api.telegram.org").replace(/\/+$/, "");

async function api<T>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${apiBase}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
  if (!res.ok || !json?.ok) throw new Error(`${method} gagal (${res.status}): ${json?.description ?? "tanpa deskripsi"}`);
  return json.result as T;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  if (!token) fail("TELEGRAM_BOT_TOKEN belum diisi di .env.local (buat bot lewat @BotFather).");

  switch (command) {
    case "info": {
      const me = await api<{ username?: string }>("getMe");
      const info = await api<{ url: string; pending_update_count: number; last_error_date?: number; last_error_message?: string }>(
        "getWebhookInfo",
      );
      console.log(`Bot: @${me.username ?? "?"}  (isi TELEGRAM_BOT_USERNAME dengan nilai ini, tanpa @)`);
      console.log(`Webhook: ${info.url || "(belum diset)"}`);
      console.log(`Update tertunda: ${info.pending_update_count}`);
      if (info.last_error_message) {
        console.log(`Galat terakhir: ${info.last_error_message} (${new Date((info.last_error_date ?? 0) * 1000).toISOString()})`);
      }
      return;
    }
    case "set": {
      if (!secret) fail("TELEGRAM_WEBHOOK_SECRET belum diisi di .env.local.");
      // Aturan Telegram untuk secret_token: 1-256 karakter A-Z a-z 0-9 _ -. Kami mewajibkan minimal 16 agar tidak mudah ditebak.
      if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret)) fail("TELEGRAM_WEBHOOK_SECRET harus 16-256 karakter dari A-Z a-z 0-9 _ - .");
      if (!argument) fail("Gunakan: npm run telegram:webhook -- set https://domain-publik-anda.example");

      let base: URL;
      try {
        base = new URL(argument);
      } catch {
        fail("URL tidak valid.");
      }
      if (base.protocol !== "https:") fail("Telegram hanya menerima webhook HTTPS.");

      const url = new URL(WEBHOOK_PATH, base).toString();
      await api<boolean>("setWebhook", {
        url,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"],
      });
      console.log(`Webhook diset ke ${url}`);
      return;
    }
    case "delete": {
      await api<boolean>("deleteWebhook");
      console.log("Webhook dihapus.");
      return;
    }
    default:
      fail("Perintah: info | set <https-url> | delete");
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
