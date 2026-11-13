import type { PrismaClient } from "@/generated/prisma/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { DomainError } from "@/lib/errors";
import { TelegramApiError, type InlineKeyboardButton, type TelegramClient } from "./client";

export interface OutboundInput {
  supplierId: string;
  chatId: number;
  sessionId?: string | null;
  text: string;
  /** Satu pesan logis = satu kunci; mengirim ulang dengan kunci sama tidak mengirim pesan kedua. */
  idempotencyKey: string;
  sender?: "AI" | "SYSTEM";
  inlineKeyboard?: InlineKeyboardButton[][];
}

export interface OutboundResult {
  messageId: string;
  telegramMessageId: number | null;
  /** True bila pesan ini sudah terkirim atau sedang dikirim oleh pemanggil lain (tidak dikirim lagi). */
  duplicate: boolean;
}

/**
 * Pengirim lain dianggap masih "dalam proses" selama catatan menunggu lebih muda dari ini. Lewat dari itu catatan
 * dianggap sisa proses yang mati, dan pemanggil berikutnya mengirim ulang.
 */
export const IN_FLIGHT_WINDOW_MS = 60_000;

/**
 * Kirim pesan ke chat Telegram dengan catatan audit, idempoten (SUPPLIO.md §5):
 *  1. PEMILIK kunci = pemanggil yang berhasil membuat baris OUTBOUND (telegramMessageId kosong = "menunggu");
 *  2. hanya pemilik yang memanggil Telegram, lalu mengisi telegramMessageId;
 *  3. pemanggil lain dengan kunci sama: sudah terkirim → duplicate; masih menunggu & baru → duplicate (sedang dikirim);
 *     menunggu & sudah usang → pengirim sebelumnya mati, kirim ulang.
 * Bila pengiriman GAGAL (galat sementara/diblokir) baris menunggu dihapus, sehingga retry langsung boleh mengirim.
 * Satu-satunya celah tersisa: proses mati tepat antara Telegram menerima pesan dan baris diperbarui; Telegram tidak
 * menyediakan kunci idempotensi, jadi pada retry setelah jendela di atas pesan bisa terkirim sekali lagi.
 */
export async function sendOutbound(db: PrismaClient, tg: TelegramClient, input: OutboundInput): Promise<OutboundResult> {
  const select = { id: true, telegramMessageId: true, createdAt: true } as const;
  const find = () => db.conversationMessage.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select });

  let record = await find();
  let owner = false;
  if (!record) {
    try {
      record = await db.conversationMessage.create({
        data: {
          sessionId: input.sessionId ?? null,
          supplierId: input.supplierId,
          direction: "OUTBOUND",
          sender: input.sender ?? "AI",
          content: input.text,
          idempotencyKey: input.idempotencyKey,
        },
        select,
      });
      owner = true;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      record = await find(); // pemanggil lain baru saja membuatnya
      if (!record) throw e;
    }
  }

  if (record.telegramMessageId !== null) {
    return { messageId: record.id, telegramMessageId: Number(record.telegramMessageId), duplicate: true };
  }
  if (!owner && Date.now() - record.createdAt.getTime() < IN_FLIGHT_WINDOW_MS) {
    return { messageId: record.id, telegramMessageId: null, duplicate: true };
  }

  try {
    const sent = await tg.sendMessage({ chatId: input.chatId, text: input.text, inlineKeyboard: input.inlineKeyboard });
    await db.conversationMessage.update({ where: { id: record.id }, data: { telegramMessageId: BigInt(sent.messageId) } });
    return { messageId: record.id, telegramMessageId: sent.messageId, duplicate: false };
  } catch (e) {
    // Tidak terkirim: lepaskan klaim agar retry bisa mengirim (dan riwayat tidak memuat pesan yang tak pernah sampai).
    await db.conversationMessage.deleteMany({ where: { id: record.id, telegramMessageId: null } });

    if (e instanceof TelegramApiError && e.isBlockedOrGone) {
      // Supplier memblokir bot / chat hilang: putuskan koneksi agar tidak dicoba terus.
      await db.supplier.updateMany({
        where: { id: input.supplierId, telegramChatId: BigInt(input.chatId) },
        data: { telegramVerifiedAt: null },
      });
      throw new DomainError("SUPPLIER_UNREACHABLE", "Supplier tidak dapat dihubungi lewat Telegram (bot diblokir atau chat tidak ada).", 409);
    }
    throw e;
  }
}

/** Kirim ke supplier yang sudah terverifikasi. Gagal bila belum onboarding (bot tidak bisa memulai chat lebih dulu). */
export async function sendToSupplier(
  db: PrismaClient,
  tg: TelegramClient,
  input: Omit<OutboundInput, "chatId">,
): Promise<OutboundResult> {
  const supplier = await db.supplier.findUnique({
    where: { id: input.supplierId },
    select: { telegramChatId: true, telegramVerifiedAt: true, isActive: true },
  });
  if (!supplier?.isActive || supplier.telegramChatId === null || supplier.telegramVerifiedAt === null) {
    throw new DomainError("SUPPLIER_NOT_CONNECTED", "Supplier belum terhubung ke Telegram.", 409);
  }
  return sendOutbound(db, tg, { ...input, chatId: Number(supplier.telegramChatId) });
}
