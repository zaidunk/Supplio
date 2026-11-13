import { z } from "zod";

/**
 * Update Telegram = DATA TIDAK TEPERCAYA. Hanya field yang dipakai yang divalidasi; sisanya dibuang.
 * Pesan teks supplier diperlakukan sebagai data percakapan, bukan instruksi.
 */
const chat = z.object({ id: z.number().int(), type: z.string() });
const user = z.object({ id: z.number().int(), is_bot: z.boolean().optional() });

const message = z.object({
  message_id: z.number().int(),
  from: user.optional(),
  chat,
  text: z.string().optional(),
});

const callbackQuery = z.object({
  id: z.string().min(1),
  from: user,
  message: z.object({ message_id: z.number().int(), chat }).optional(),
  data: z.string().max(64).optional(),
});

export const telegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: message.optional(),
  callback_query: callbackQuery.optional(),
});

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;

/** Hanya `update_id` yang wajib agar bisa dideduplikasi dan disimpan mentah. */
export const rawUpdateEnvelope = z.object({ update_id: z.number().int().nonnegative() }).passthrough();
