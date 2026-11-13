import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { DomainError } from "@/lib/errors";
import { TelegramApiError, type TelegramClient } from "./client";
import {
  CONSENT_BUTTON_TEXT,
  INVALID_LINK_REPLY,
  WELCOME_REPLY,
  buildConnectedMessage,
  buildConsentMessage,
} from "./messages";
import { sendOutbound } from "./outbound";

/** Hanya hash token yang disimpan; token mentah ada di tautan saja. */
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Payload /start Telegram: A-Z a-z 0-9 _ - sampai 64 karakter. */
const START_PAYLOAD = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Tautan onboarding sekali pakai & berkedaluwarsa (SUPPLIO.md §5):
 * https://t.me/<BOT_USERNAME>?start=<token>. Tautan lama yang belum dipakai dibatalkan.
 */
export async function createLinkToken(
  db: PrismaClient,
  params: { businessId: string; supplierId: string; botUsername: string; ttlHours: number; now?: Date },
): Promise<{ url: string; expiresAt: Date }> {
  const supplier = await db.supplier.findFirst({
    where: { id: params.supplierId, businessId: params.businessId },
    select: { id: true },
  });
  if (!supplier) throw new DomainError("SUPPLIER_NOT_FOUND", "Supplier tidak ditemukan.", 404);

  const now = params.now ?? new Date();
  const token = randomBytes(32).toString("base64url"); // 43 karakter, dalam batas payload Telegram
  const expiresAt = new Date(now.getTime() + params.ttlHours * 3_600_000);

  await db.$transaction([
    db.telegramLinkToken.deleteMany({ where: { supplierId: supplier.id, usedAt: null } }),
    db.telegramLinkToken.create({ data: { supplierId: supplier.id, tokenHash: hashToken(token), expiresAt } }),
  ]);

  const username = params.botUsername.replace(/^@/, "");
  return { url: `https://t.me/${username}?start=${token}`, expiresAt };
}

/** `/start` tanpa/tanpa payload valid. Balasan hanya ke chat pribadi. */
export async function handleStart(
  db: PrismaClient,
  tg: TelegramClient,
  params: { updateId: number; chatId: number; chatType: string; payload: string | null; now?: Date },
): Promise<void> {
  if (params.chatType !== "private") return;
  const now = params.now ?? new Date();

  if (!params.payload) {
    await tg.sendMessage({ chatId: params.chatId, text: WELCOME_REPLY });
    return;
  }
  const token = START_PAYLOAD.test(params.payload)
    ? await db.telegramLinkToken.findUnique({
        where: { tokenHash: hashToken(params.payload) },
        include: { supplier: { select: { id: true, name: true, telegramChatId: true, business: { select: { name: true } } } } },
      })
    : null;

  const alreadyThisChat = token?.usedAt && token.supplier.telegramChatId === BigInt(params.chatId);
  const usable = token && !token.usedAt && token.expiresAt.getTime() > now.getTime();

  if (!token || (!usable && !alreadyThisChat)) {
    await tg.sendMessage({ chatId: params.chatId, text: INVALID_LINK_REPLY });
    return;
  }

  if (alreadyThisChat) {
    await sendOutbound(db, tg, {
      supplierId: token.supplier.id,
      chatId: params.chatId,
      text: buildConnectedMessage({ businessName: token.supplier.business.name }),
      idempotencyKey: `update:${params.updateId}:already-connected`,
      sender: "SYSTEM",
    });
    return;
  }

  // Minta persetujuan eksplisit; koneksi baru disimpan setelah tombol ditekan (callback).
  await sendOutbound(db, tg, {
    supplierId: token.supplier.id,
    chatId: params.chatId,
    text: buildConsentMessage({ businessName: token.supplier.business.name, supplierName: token.supplier.name }),
    idempotencyKey: `update:${params.updateId}:consent`,
    sender: "SYSTEM",
    inlineKeyboard: [[{ text: CONSENT_BUTTON_TEXT, callback_data: `link:${token.id}` }]],
  });
}

export type ConfirmationResult =
  | { connected: true; supplierId: string; businessId: string; alreadyConnected: boolean }
  | { connected: false; reason: "INVALID" | "USED_OR_EXPIRED" | "CHAT_IN_USE" | "NOT_PRIVATE" };

/**
 * Tombol persetujuan ditekan: simpan telegramChatId/UserId/VerifiedAt dan hanguskan token (sekali pakai).
 * Atomik dan aman dari balapan: dua penekanan serentak → hanya satu yang menang (`usedAt IS NULL`).
 * Pemrosesan ulang update yang sama (retry) setelah sukses dianggap sudah terhubung, bukan galat.
 */
export async function handleLinkConfirmation(
  db: PrismaClient,
  tg: TelegramClient,
  params: {
    updateId: number;
    callbackQueryId: string;
    chatId: number;
    chatType: string;
    userId: number;
    tokenId: string;
    now?: Date;
  },
): Promise<ConfirmationResult> {
  const now = params.now ?? new Date();
  const answer = async (text: string) => {
    try {
      await tg.answerCallbackQuery(params.callbackQueryId, text);
    } catch (e) {
      if (!(e instanceof TelegramApiError)) throw e; // callback kedaluwarsa tidak boleh menggagalkan alur
    }
  };

  if (params.chatType !== "private") {
    await answer("Koneksi hanya bisa dilakukan lewat chat pribadi.");
    return { connected: false, reason: "NOT_PRIVATE" };
  }

  const token = await db.telegramLinkToken.findUnique({
    where: { id: params.tokenId },
    include: { supplier: { select: { id: true, businessId: true, telegramChatId: true, business: { select: { name: true } } } } },
  });
  if (!token) {
    await answer("Tautan tidak valid.");
    return { connected: false, reason: "INVALID" };
  }
  const { supplier } = token;

  const result = ((): "RETRY_OK" | "EXPIRED" | "TRY" => {
    if (token.usedAt) return supplier.telegramChatId === BigInt(params.chatId) ? "RETRY_OK" : "EXPIRED";
    return token.expiresAt.getTime() > now.getTime() ? "TRY" : "EXPIRED";
  })();

  if (result === "EXPIRED") {
    await answer("Tautan sudah dipakai atau kedaluwarsa.");
    return { connected: false, reason: "USED_OR_EXPIRED" };
  }

  const alreadyConnected = result === "RETRY_OK";
  if (result === "TRY") {
    try {
      const won = await db.$transaction(async (tx) => {
        const claimed = await tx.telegramLinkToken.updateMany({
          where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (claimed.count === 0) return false;
        await tx.supplier.update({
          where: { id: supplier.id },
          data: { telegramChatId: BigInt(params.chatId), telegramUserId: BigInt(params.userId), telegramVerifiedAt: now },
        });
        return true;
      });
      if (!won) {
        await answer("Tautan sudah dipakai atau kedaluwarsa.");
        return { connected: false, reason: "USED_OR_EXPIRED" };
      }
    } catch (e) {
      if (isUniqueViolation(e)) {
        await answer("Chat ini sudah terhubung ke supplier lain.");
        return { connected: false, reason: "CHAT_IN_USE" };
      }
      throw e;
    }
  }

  await answer("Terhubung. Terima kasih!");
  await sendOutbound(db, tg, {
    supplierId: supplier.id,
    chatId: params.chatId,
    text: buildConnectedMessage({ businessName: supplier.business.name }),
    idempotencyKey: `update:${params.updateId}:connected`,
    sender: "SYSTEM",
  });
  return { connected: true, supplierId: supplier.id, businessId: supplier.businessId, alreadyConnected };
}
