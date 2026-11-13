/**
 * Batas agen. Semuanya ditegakkan KODE (tool + DB), bukan prompt (SUPPLIO.md §1.5, §6).
 */

/** Maksimal satu putaran counter-offer per supplier per procurement request (§1.2); juga CHECK di database. */
export const MAX_COUNTER_OFFERS = 1;

/** Klarifikasi bukan counter-offer tetapi tetap dibatasi ("batas pesan yang wajar", §5). */
export const MAX_CLARIFICATIONS = 3;

/** Total pesan AI (termasuk permintaan awal) per sesi supplier. */
export const MAX_AI_MESSAGES_PER_SESSION = 8;

/** Satu pesan keluar per giliran agar tidak membanjiri supplier. */
export const MAX_OUTBOUND_PER_TURN = 1;

/** Panggilan model berturut-turut dalam satu giliran (model → tool → model ...). */
export const MAX_MODEL_STEPS = 6;

export const MAX_MESSAGE_LENGTH = 1500;

/** Batas waktu satu panggilan model (ms). */
export const MODEL_TIMEOUT_MS = 60_000;

/** Berapa pesan terakhir yang disertakan sebagai riwayat ke model. */
export const HISTORY_LIMIT = 12;
