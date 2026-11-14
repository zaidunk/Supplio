import type { PrismaClient } from "@/generated/prisma/client";
import type { AppEvent } from "@/lib/events";
import { isUniqueViolation } from "@/lib/db/errors";
import { ACTIVE_SESSION_STATUSES } from "@/lib/procurement/sessions";
import type { TelegramClient } from "./client";
import { NO_ACTIVE_REQUEST_REPLY } from "./messages";
import { handleLinkConfirmation, handleStart } from "./onboarding";
import { sendOutbound } from "./outbound";
import { telegramUpdateSchema, type TelegramUpdate } from "./types";

export type ProcessStatus = "MISSING" | "ALREADY_PROCESSED" | "IGNORED" | "HANDLED";

export interface ProcessResult {
  status: ProcessStatus;
  /** Event lanjutan yang harus dikirim pemanggil (dikirim SETELAH pekerjaan di sini selesai). */
  events: AppEvent[];
}

const START_COMMAND = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/;
const MAX_CONTENT = 4000;

/**
 * Proses SATU update Telegram yang sudah tersimpan. Aman dipanggil berulang (retry Inngest, redispatch, fallback
 * `after()`): pesan masuk dan balasan dijaga kunci unik (`telegramUpdateId`, `idempotencyKey`), dan penautan
 * supplier dijaga token sekali pakai. Tidak menjalankan LLM (§5: webhook/pekerjaan cepat saja).
 * Menandai selesai adalah tugas pemanggil lewat `markUpdateProcessed`, setelah event lanjutannya terkirim.
 */
export async function processTelegramUpdate(db: PrismaClient, tg: TelegramClient, updateId: number): Promise<ProcessResult> {
  const row = await db.telegramUpdate.findUnique({ where: { updateId: BigInt(updateId) } });
  if (!row) return { status: "MISSING", events: [] };
  if (row.processedAt) return { status: "ALREADY_PROCESSED", events: [] };

  const parsed = telegramUpdateSchema.safeParse(row.payload);
  if (!parsed.success) return { status: "IGNORED", events: [] };
  const update = parsed.data;

  if (update.callback_query) return handleCallback(db, tg, update, update.callback_query);
  if (update.message?.text !== undefined) return handleMessage(db, tg, update, update.message);
  return { status: "IGNORED", events: [] };
}

export async function markUpdateProcessed(db: PrismaClient, updateId: number): Promise<void> {
  await db.telegramUpdate.updateMany({ where: { updateId: BigInt(updateId), processedAt: null }, data: { processedAt: new Date() } });
}

async function handleCallback(
  db: PrismaClient,
  tg: TelegramClient,
  update: TelegramUpdate,
  cb: NonNullable<TelegramUpdate["callback_query"]>,
): Promise<ProcessResult> {
  const match = /^link:([0-9a-f-]{36})$/.exec(cb.data ?? "");
  if (!match) return { status: "IGNORED", events: [] };

  // Callback dari tombol di chat pribadi: chat = tempat tombol berada (atau id pengguna bila pesan tak terlampir).
  const chatId = cb.message?.chat.id ?? cb.from.id;
  const chatType = cb.message?.chat.type ?? "private";

  await handleLinkConfirmation(db, tg, {
    updateId: update.update_id,
    callbackQueryId: cb.id,
    chatId,
    chatType,
    userId: cb.from.id,
    displayName: [cb.from.first_name, cb.from.last_name].filter(Boolean).join(" ") || undefined,
    username: cb.from.username,
    tokenId: match[1],
  });

  // Tidak ada event di sini: `supplier/telegram.connected` dikirim setelah owner mengonfirmasi chat (confirmTelegramLink).
  return { status: "HANDLED", events: [] };
}

async function handleMessage(
  db: PrismaClient,
  tg: TelegramClient,
  update: TelegramUpdate,
  message: NonNullable<TelegramUpdate["message"]>,
): Promise<ProcessResult> {
  const text = message.text ?? "";
  const start = START_COMMAND.exec(text.trim());
  if (start) {
    await handleStart(db, tg, {
      updateId: update.update_id,
      chatId: message.chat.id,
      chatType: message.chat.type,
      payload: start[1] ?? null,
    });
    return { status: "HANDLED", events: [] };
  }
  return routeInboundMessage(db, tg, update.update_id, message, text);
}

/**
 * Korelasi pesan → supplier terverifikasi → sesi aktif (satu per chat supplier). Pesan dari chat yang tidak
 * dikenal diabaikan; pesan tanpa sesi aktif dicatat dan dijawab dengan teks tetap yang aman, tanpa memulai
 * proses pengadaan apa pun (§5).
 */
async function routeInboundMessage(
  db: PrismaClient,
  tg: TelegramClient,
  updateId: number,
  message: NonNullable<TelegramUpdate["message"]>,
  text: string,
): Promise<ProcessResult> {
  if (message.chat.type !== "private") return { status: "IGNORED", events: [] };

  const supplier = await db.supplier.findFirst({
    where: { telegramChatId: BigInt(message.chat.id), telegramVerifiedAt: { not: null }, isActive: true },
    select: { id: true, businessId: true },
  });
  if (!supplier) return { status: "IGNORED", events: [] }; // bukan supplier terhubung: tidak dibalas (hindari penyalahgunaan)

  const session = await db.negotiationSession.findFirst({
    where: { supplierId: supplier.id, status: { in: [...ACTIVE_SESSION_STATUSES] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, requestId: true },
  });

  const data = {
    sessionId: session?.id ?? null,
    supplierId: supplier.id,
    direction: "INBOUND" as const,
    sender: "SUPPLIER" as const,
    content: text.slice(0, MAX_CONTENT),
    telegramMessageId: BigInt(message.message_id),
    telegramUpdateId: BigInt(updateId),
  };
  let stored: { id: string };
  try {
    stored = await db.conversationMessage.create({ data, select: { id: true } });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Pemrosesan ulang update yang sama: pesan sudah tersimpan.
    stored = await db.conversationMessage.findUniqueOrThrow({ where: { telegramUpdateId: BigInt(updateId) }, select: { id: true } });
  }

  if (!session) {
    await sendOutbound(db, tg, {
      supplierId: supplier.id,
      chatId: message.chat.id,
      text: NO_ACTIVE_REQUEST_REPLY,
      idempotencyKey: `update:${updateId}:no-session`,
      sender: "SYSTEM",
    });
    return { status: "HANDLED", events: [] };
  }

  await db.negotiationSession.update({ where: { id: session.id }, data: { lastActivityAt: new Date() } });
  return {
    status: "HANDLED",
    events: [
      {
        name: "supplier/message.received",
        data: {
          messageId: stored.id,
          sessionId: session.id,
          supplierId: supplier.id,
          businessId: supplier.businessId,
          requestId: session.requestId,
        },
      },
    ],
  };
}
