import type { ProcurementStatus } from "@/generated/prisma/client";
import { DomainError } from "@/lib/errors";

/**
 * State machine ProcurementRequest (SUPPLIO.md §9). Murni, tanpa DB.
 * Setiap transisi divalidasi server; event/job terlambat tidak boleh memundurkan status.
 */
export const TRANSITIONS: Record<ProcurementStatus, readonly ProcurementStatus[]> = {
  CONFIGURATION_REQUIRED: ["DRAFT", "CANCELLED"],
  DRAFT: ["SOURCING", "CANCELLED", "EXPIRED"],
  SOURCING: ["AWAITING_RESPONSES", "CANCELLED", "EXPIRED"],
  AWAITING_RESPONSES: ["OPTIMIZING", "CANCELLED", "EXPIRED"],
  OPTIMIZING: ["AWAITING_APPROVAL", "NO_FEASIBLE_SOLUTION", "CANCELLED", "EXPIRED"],
  // Kembali ke OPTIMIZING bila validasi ulang saat approval menemukan data berubah (§4.3).
  AWAITING_APPROVAL: ["APPROVED", "OPTIMIZING", "CANCELLED", "EXPIRED"],
  APPROVED: ["ORDERED"],
  ORDERED: ["PARTIALLY_RECEIVED", "COMPLETED"],
  PARTIALLY_RECEIVED: ["COMPLETED"],
  COMPLETED: [],
  NO_FEASIBLE_SOLUTION: [],
  CANCELLED: [],
  EXPIRED: [],
};

/**
 * Status "proses sourcing aktif": dibatasi SATU per bisnis (§4.1) dan kebutuhannya dianggap sedang ditangani.
 * HARUS identik dengan WHERE pada index unik parsial `ProcurementRequest_one_active_per_business`
 * (dijaga oleh tests/unit/lifecycle.test.ts). ORDERED/PARTIALLY_RECEIVED sengaja tidak termasuk:
 * kebutuhannya sudah tercakup oleh incomingQuantity dari PO outstanding.
 */
export const SOURCING_ACTIVE_STATUSES = [
  "DRAFT",
  "SOURCING",
  "AWAITING_RESPONSES",
  "OPTIMIZING",
  "AWAITING_APPROVAL",
  "APPROVED",
] as const satisfies readonly ProcurementStatus[];

export const TERMINAL_STATUSES = (Object.keys(TRANSITIONS) as ProcurementStatus[]).filter(
  (s) => TRANSITIONS[s].length === 0,
);

export const canTransition = (from: ProcurementStatus, to: ProcurementStatus): boolean =>
  TRANSITIONS[from].includes(to);

export const isSourcingActive = (status: ProcurementStatus): boolean =>
  (SOURCING_ACTIVE_STATUSES as readonly ProcurementStatus[]).includes(status);

export function assertTransition(from: ProcurementStatus, to: ProcurementStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError("INVALID_TRANSITION", `Transisi status ${from} → ${to} tidak diizinkan.`, 409);
  }
}
