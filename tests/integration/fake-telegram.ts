import { randomInt } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { TelegramApiError, type SendMessageArgs, type TelegramClient } from "@/lib/telegram/client";
import { markUpdateProcessed, processTelegramUpdate } from "@/lib/telegram/process-update";

/** Telegram palsu di memori: merekam pesan keluar dan dapat dipaksa gagal per chat. */
export class FakeTelegram implements TelegramClient {
  sent: (SendMessageArgs & { messageId: number })[] = [];
  answers: { id: string; text?: string }[] = [];
  /** chatId → status HTTP yang dikembalikan sebagai galat (mis. 403 = bot diblokir). */
  failChats = new Map<number, number>();
  private next = 1000;

  async sendMessage(args: SendMessageArgs) {
    const status = this.failChats.get(args.chatId);
    if (status) throw new TelegramApiError("sendMessage", status, status === 403 ? "Forbidden: bot was blocked by the user" : "error");
    const messageId = this.next++;
    this.sent.push({ ...args, messageId });
    return { messageId };
  }
  async answerCallbackQuery(id: string, text?: string) {
    this.answers.push({ id, text });
  }
  to(chatId: number) {
    return this.sent.filter((m) => m.chatId === chatId);
  }
}

const createdUpdateIds: bigint[] = [];

/** update_id acak besar agar tidak bentrok dengan data lain di DB bersama. */
export const newUpdateId = () => randomInt(1_000_000_000, 9_000_000_000);
export const newChatId = () => randomInt(1_000_000_000, 9_000_000_000);

export const textUpdate = (o: { updateId?: number; chatId: number; text: string; messageId?: number; chatType?: string }) => ({
  update_id: o.updateId ?? newUpdateId(),
  message: {
    message_id: o.messageId ?? randomInt(1, 1_000_000),
    from: { id: o.chatId, is_bot: false },
    chat: { id: o.chatId, type: o.chatType ?? "private" },
    text: o.text,
    date: 1_700_000_000,
  },
});

export const callbackUpdate = (o: { updateId?: number; chatId: number; data: string; callbackId?: string }) => ({
  update_id: o.updateId ?? newUpdateId(),
  callback_query: {
    id: o.callbackId ?? `cb-${randomInt(1, 1_000_000)}`,
    from: { id: o.chatId, is_bot: false },
    message: { message_id: 1, chat: { id: o.chatId, type: "private" } },
    data: o.data,
  },
});

/** Simpan update (seperti webhook) lalu proses, dan tandai selesai bila berhasil. */
export async function ingest(db: PrismaClient, tg: TelegramClient, update: { update_id: number }) {
  await db.telegramUpdate.create({ data: { updateId: BigInt(update.update_id), payload: update as object } });
  createdUpdateIds.push(BigInt(update.update_id));
  const result = await processTelegramUpdate(db, tg, update.update_id);
  await markUpdateProcessed(db, update.update_id);
  return result;
}

export async function cleanupUpdates(db: PrismaClient) {
  if (createdUpdateIds.length === 0) return;
  await db.telegramUpdate.deleteMany({ where: { updateId: { in: createdUpdateIds.splice(0) } } });
}
