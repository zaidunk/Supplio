import type { NegotiationStatus } from "@/generated/prisma/client";

/**
 * Sesi yang masih "hidup": satu per supplier (index unik parsial `NegotiationSession_one_active_per_supplier`),
 * sehingga balasan di satu chat supplier selalu dipetakan ke satu sesi (SUPPLIO.md §5).
 * HARUS identik dengan WHERE index itu (dijaga oleh tests/unit/sessions.test.ts).
 */
export const ACTIVE_SESSION_STATUSES = ["CONTACTED", "AWAITING_REPLY", "CLARIFYING", "NEGOTIATING"] as const satisfies readonly NegotiationStatus[];

/** Sesi selesai: tidak menunggu apa pun lagi. */
export const FINAL_SESSION_STATUSES = ["CONFIRMED", "DECLINED", "TIMED_OUT"] as const satisfies readonly NegotiationStatus[];

export const isSessionFinal = (status: NegotiationStatus): boolean =>
  (FINAL_SESSION_STATUSES as readonly NegotiationStatus[]).includes(status);
