import type { PrismaClient, ProcurementStatus } from "@/generated/prisma/client";
import type { Db } from "@/lib/db/types";
import { DomainError } from "@/lib/errors";
import { assertTransition } from "./lifecycle";

export interface TransitionInput {
  requestId: string;
  businessId: string;
  to: ProcurementStatus;
  reason?: string;
}

/**
 * Pindah status secara atomik. Dipakai di dalam transaksi pemanggil (`tx`).
 * - Transisi yang tidak ada di state machine ditolak (tidak bisa memundurkan status).
 * - UPDATE bersyarat `WHERE status = <status terbaca>`: dua pekerja yang berlomba tidak saling menimpa.
 * - Status sudah sama dengan tujuan → no-op (event terlambat/duplikat aman).
 */
export async function transitionRequestTx(
  tx: Db,
  { requestId, businessId, to, reason }: TransitionInput,
): Promise<{ changed: boolean; from: ProcurementStatus }> {
  const request = await tx.procurementRequest.findFirst({
    where: { id: requestId, businessId },
    select: { status: true },
  });
  if (!request) throw new DomainError("REQUEST_NOT_FOUND", "Procurement request tidak ditemukan.", 404);

  if (request.status === to) return { changed: false, from: request.status };
  assertTransition(request.status, to);

  const updated = await tx.procurementRequest.updateMany({
    where: { id: requestId, businessId, status: request.status },
    data: { status: to },
  });
  if (updated.count === 0) {
    throw new DomainError("STALE_TRANSITION", "Status request sudah berubah; muat ulang.", 409);
  }

  await tx.procurementStatusTransition.create({
    data: { requestId, fromStatus: request.status, toStatus: to, reason: reason ?? null },
  });
  return { changed: true, from: request.status };
}

export function transitionRequest(db: PrismaClient, input: TransitionInput) {
  return db.$transaction((tx) => transitionRequestTx(tx, input));
}
