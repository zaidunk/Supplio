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
  buildPendingMessage,
  buildRejectedMessage,
} from "./messages";
import { sendOutbound } from "./outbound";

/** Hanya hash token yang disimpan; token mentah ada di tautan saja. */
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Payload /start Telegram: A-Z a-z 0-9 _ - sampai 64 karakter. */
const START_PAYLOAD = /^[A-Za-z0-9_-]{16,64}$/;

const SUPPLIER_LINK_SELECT = {
  id: true,
  name: true,
  businessId: true,
  telegramChatId: true,
  telegramVerifiedAt: true,
  telegramPendingChatId: true,
  business: { select: { name: true } },
} as const;

interface SupplierLinkState {
  telegramChatId: bigint | null;
  telegramVerifiedAt: Date | null;
  telegramPendingChatId: bigint | null;
  business: { name: string };
}

const isVerifiedChat = (s: SupplierLinkState, chatId: number) => s.telegramVerifiedAt !== null && s.telegramChatId === BigInt(chatId);
const isSupplierChat = (s: SupplierLinkState, chatId: number) => isVerifiedChat(s, chatId) || s.telegramPendingChatId === BigInt(chatId);

/** Chat sudah dikonfirmasi owner → "terhubung"; selain itu masih menunggu konfirmasi. */
const statusMessage = (s: SupplierLinkState, chatId: number) =>
  isVerifiedChat(s, chatId) ? buildConnectedMessage({ businessName: s.business.name }) : buildPendingMessage({ businessName: s.business.name });

/** Dilempar di dalam transaksi agar token yang sudah diklaim ikut di-rollback saat chat dipakai supplier lain. */
class ChatInUse extends Error {}

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
        include: { supplier: { select: SUPPLIER_LINK_SELECT } },
      })
    : null;

  const alreadyThisChat = token?.usedAt && isSupplierChat(token.supplier, params.chatId);
  const usable = token && !token.usedAt && token.expiresAt.getTime() > now.getTime();

  if (!token || (!usable && !alreadyThisChat)) {
    await tg.sendMessage({ chatId: params.chatId, text: INVALID_LINK_REPLY });
    return;
  }

  if (alreadyThisChat) {
    await sendOutbound(db, tg, {
      supplierId: token.supplier.id,
      chatId: params.chatId,
      text: statusMessage(token.supplier, params.chatId),
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
  | { accepted: true; supplierId: string; businessId: string; outcome: "PENDING_OWNER" | "ALREADY_CONNECTED" }
  | { accepted: false; reason: "INVALID" | "USED_OR_EXPIRED" | "CHAT_IN_USE" | "NOT_PRIVATE" };

/**
 * Tombol persetujuan ditekan: chat disimpan sebagai MENUNGGU konfirmasi owner (telegramPending*) dan token hangus
 * (sekali pakai). `telegramVerifiedAt` TIDAK diisi di sini; chat baru bisa dihubungi/menghubungi agen setelah owner
 * menekan Konfirmasi di dashboard (`confirmTelegramLink`). Koneksi lama (bila ada) tetap berlaku sampai saat itu.
 * Atomik dan aman dari balapan: dua penekanan serentak → hanya satu yang menang (`usedAt IS NULL`).
 * Pemrosesan ulang update yang sama (retry) setelah sukses dianggap sudah diterima, bukan galat.
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
    displayName?: string;
    username?: string;
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
    return { accepted: false, reason: "NOT_PRIVATE" };
  }

  const token = await db.telegramLinkToken.findUnique({
    where: { id: params.tokenId },
    include: { supplier: { select: SUPPLIER_LINK_SELECT } },
  });
  if (!token) {
    await answer("Tautan tidak valid.");
    return { accepted: false, reason: "INVALID" };
  }
  const { supplier } = token;

  const result = ((): "RETRY_OK" | "EXPIRED" | "TRY" => {
    if (token.usedAt) return isSupplierChat(supplier, params.chatId) ? "RETRY_OK" : "EXPIRED";
    return token.expiresAt.getTime() > now.getTime() ? "TRY" : "EXPIRED";
  })();

  if (result === "EXPIRED") {
    await answer("Tautan sudah dipakai atau kedaluwarsa.");
    return { accepted: false, reason: "USED_OR_EXPIRED" };
  }

  let alreadyVerified = isVerifiedChat(supplier, params.chatId);
  if (result === "TRY") {
    try {
      const won = await db.$transaction(async (tx) => {
        const claimed = await tx.telegramLinkToken.updateMany({
          where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (claimed.count === 0) return false;
        // Chat yang sama sudah dikonfirmasi owner untuk supplier ini: tidak perlu konfirmasi ulang.
        if (alreadyVerified) return true;
        const taken = await tx.supplier.findFirst({
          where: { telegramChatId: BigInt(params.chatId), id: { not: supplier.id } },
          select: { id: true },
        });
        if (taken) throw new ChatInUse();
        await tx.supplier.update({
          where: { id: supplier.id },
          data: {
            telegramPendingChatId: BigInt(params.chatId),
            telegramPendingUserId: BigInt(params.userId),
            telegramPendingName: params.displayName?.slice(0, 100) || null,
            telegramPendingUsername: params.username?.slice(0, 100) || null,
            telegramPendingAt: now,
          },
        });
        return true;
      });
      if (!won) {
        await answer("Tautan sudah dipakai atau kedaluwarsa.");
        return { accepted: false, reason: "USED_OR_EXPIRED" };
      }
    } catch (e) {
      if (e instanceof ChatInUse || isUniqueViolation(e)) {
        await answer("Chat ini sudah terhubung ke supplier lain.");
        return { accepted: false, reason: "CHAT_IN_USE" };
      }
      throw e;
    }
  } else {
    // Retry: owner mungkin sudah mengonfirmasi di antara percobaan; baca status terbaru.
    const fresh = await db.supplier.findUnique({ where: { id: supplier.id }, select: SUPPLIER_LINK_SELECT });
    alreadyVerified = fresh ? isVerifiedChat(fresh, params.chatId) : false;
  }

  await answer(alreadyVerified ? "Terhubung. Terima kasih!" : "Disetujui. Menunggu konfirmasi dari UMKM.");
  await sendOutbound(db, tg, {
    supplierId: supplier.id,
    chatId: params.chatId,
    text: alreadyVerified
      ? buildConnectedMessage({ businessName: supplier.business.name })
      : buildPendingMessage({ businessName: supplier.business.name }),
    idempotencyKey: `update:${params.updateId}:${alreadyVerified ? "connected" : "pending"}`,
    sender: "SYSTEM",
  });
  return {
    accepted: true,
    supplierId: supplier.id,
    businessId: supplier.businessId,
    outcome: alreadyVerified ? "ALREADY_CONNECTED" : "PENDING_OWNER",
  };
}

/**
 * Owner menekan Konfirmasi: chat yang menunggu menjadi chat terverifikasi supplier. Satu-satunya jalan mengisi
 * `telegramVerifiedAt` untuk chat baru. Event `supplier/telegram.connected` baru dikirim di sini (melanjutkan request
 * DRAFT), bukan saat supplier menyetujui di Telegram.
 */
export async function confirmTelegramLink(
  db: PrismaClient,
  tg: TelegramClient,
  params: { businessId: string; supplierId: string; now?: Date },
): Promise<{ supplierId: string; businessId: string; verifiedAt: Date }> {
  const now = params.now ?? new Date();
  let confirmed: { chatId: bigint; businessName: string };
  try {
    confirmed = await db.$transaction(async (tx) => {
      const s = await tx.supplier.findFirst({
        where: { id: params.supplierId, businessId: params.businessId },
        select: { telegramPendingChatId: true, telegramPendingUserId: true, business: { select: { name: true } } },
      });
      if (!s) throw new DomainError("SUPPLIER_NOT_FOUND", "Supplier tidak ditemukan.", 404);
      if (s.telegramPendingChatId === null) {
        throw new DomainError("NO_PENDING_CONNECTION", "Tidak ada koneksi Telegram yang menunggu konfirmasi.", 409);
      }
      const updated = await tx.supplier.updateMany({
        where: { id: params.supplierId, businessId: params.businessId, telegramPendingChatId: s.telegramPendingChatId },
        data: {
          telegramChatId: s.telegramPendingChatId,
          telegramUserId: s.telegramPendingUserId,
          telegramVerifiedAt: now,
          telegramPendingChatId: null,
          telegramPendingUserId: null,
          telegramPendingName: null,
          telegramPendingUsername: null,
          telegramPendingAt: null,
        },
      });
      if (updated.count === 0) {
        throw new DomainError("NO_PENDING_CONNECTION", "Tidak ada koneksi Telegram yang menunggu konfirmasi.", 409);
      }
      return { chatId: s.telegramPendingChatId, businessName: s.business.name };
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new DomainError("CHAT_IN_USE", "Chat ini sudah terhubung ke supplier lain.", 409);
    }
    throw e;
  }

  await sendOutbound(db, tg, {
    supplierId: params.supplierId,
    chatId: Number(confirmed.chatId),
    text: buildConnectedMessage({ businessName: confirmed.businessName }),
    idempotencyKey: `link-confirmed:${params.supplierId}:${confirmed.chatId}:${now.getTime()}`,
    sender: "SYSTEM",
  });
  return { supplierId: params.supplierId, businessId: params.businessId, verifiedAt: now };
}

/** Owner menekan Tolak: chat yang menunggu dilepas. Supplier diberi tahu sekali bila masih bisa dihubungi. */
export async function rejectTelegramLink(
  db: PrismaClient,
  tg: TelegramClient,
  params: { businessId: string; supplierId: string },
): Promise<void> {
  const s = await db.supplier.findFirst({
    where: { id: params.supplierId, businessId: params.businessId },
    select: { telegramPendingChatId: true, business: { select: { name: true } } },
  });
  if (!s) throw new DomainError("SUPPLIER_NOT_FOUND", "Supplier tidak ditemukan.", 404);
  const chatId = s.telegramPendingChatId;
  if (chatId === null) {
    throw new DomainError("NO_PENDING_CONNECTION", "Tidak ada koneksi Telegram yang menunggu konfirmasi.", 409);
  }
  const released = await db.supplier.updateMany({
    where: { id: params.supplierId, businessId: params.businessId, telegramPendingChatId: chatId },
    data: { telegramPendingChatId: null, telegramPendingUserId: null, telegramPendingName: null, telegramPendingUsername: null, telegramPendingAt: null },
  });
  if (released.count === 0) {
    throw new DomainError("NO_PENDING_CONNECTION", "Tidak ada koneksi Telegram yang menunggu konfirmasi.", 409);
  }
  try {
    await tg.sendMessage({ chatId: Number(chatId), text: buildRejectedMessage({ businessName: s.business.name }) });
  } catch (e) {
    if (!(e instanceof TelegramApiError)) throw e; // pemberitahuan gagal tidak membatalkan penolakan
  }
}
