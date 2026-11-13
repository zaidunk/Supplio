import { after, NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { dispatchEvents } from "@/inngest/dispatch";
import { prisma } from "@/lib/db/prisma";
import { isUniqueViolation } from "@/lib/db/errors";
import { getServerEnv } from "@/lib/env";
import { markUpdateProcessed, processTelegramUpdate } from "@/lib/telegram/process-update";
import { secretMatches } from "@/lib/telegram/secret";
import { getTelegramClient } from "@/lib/telegram/server";
import { rawUpdateEnvelope } from "@/lib/telegram/types";

const MAX_BODY_BYTES = 1_000_000;

const json = (status: number, body: unknown) => NextResponse.json(body, { status });

/**
 * Webhook Telegram (SUPPLIO.md §5). Tidak memakai sesi owner; keamanannya: header
 * `X-Telegram-Bot-Api-Secret-Token`, dedup `update_id`, dan chat yang sudah terikat ke supplier.
 * Urutan: verifikasi → simpan update mentah → picu pekerjaan async → segera 2xx. Tidak ada LLM/pekerjaan lama di sini.
 */
export async function POST(request: NextRequest) {
  const expected = getServerEnv().TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return json(503, { error: { code: "WEBHOOK_NOT_CONFIGURED", message: "Webhook belum dikonfigurasi." } });

  if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), expected)) {
    return json(401, { error: { code: "INVALID_SECRET", message: "Secret tidak valid." } });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return json(413, { error: { code: "PAYLOAD_TOO_LARGE", message: "Payload terlalu besar." } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: { code: "INVALID_JSON", message: "Body bukan JSON." } });
  }
  const envelope = rawUpdateEnvelope.safeParse(body);
  if (!envelope.success) return json(400, { error: { code: "INVALID_UPDATE", message: "update_id wajib ada." } });
  const updateId = envelope.data.update_id;

  try {
    await prisma.telegramUpdate.create({ data: { updateId: BigInt(updateId), payload: body as Prisma.InputJsonValue } });
  } catch (e) {
    // Telegram mengirim ulang update yang sama (retry): sudah tercatat → 2xx tanpa memproses ulang.
    if (isUniqueViolation(e)) return json(200, { ok: true, duplicate: true });
    throw e; // gagal menyimpan → 500 agar Telegram mengirim ulang
  }

  // Id event = update_id: pengiriman ganda terdedup oleh Inngest.
  const dispatched = await dispatchEvents([{ id: `tg-${updateId}`, name: "telegram/update.received", data: { updateId } }]);

  if (!dispatched) {
    // Inngest tidak terjangkau (mis. dev lokal): proses langsung SETELAH respons dikirim. Tetap idempotent.
    after(async () => {
      try {
        const result = await processTelegramUpdate(prisma, getTelegramClient(), updateId);
        if (await dispatchEvents(result.events)) await markUpdateProcessed(prisma, updateId);
        // Bila event lanjutan gagal terkirim, update tetap "belum selesai" dan akan diulang oleh redispatch-stale.
      } catch (e) {
        console.error("[telegram] pemrosesan fallback gagal:", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      }
    });
  }
  return json(200, { ok: true });
}
