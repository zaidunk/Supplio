import type { PrismaClient } from "@/generated/prisma/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { DomainError } from "@/lib/errors";
import type { TelegramClient } from "@/lib/telegram/client";
import { buildOutreachMessage } from "@/lib/telegram/messages";
import { sendToSupplier } from "@/lib/telegram/outbound";
import { SOURCING_ACTIVE_STATUSES } from "./lifecycle";
import { runOptimization, type OptimizationRun } from "./optimize";
import { ACTIVE_SESSION_STATUSES, FINAL_SESSION_STATUSES } from "./sessions";
import { transitionRequest, transitionRequestTx } from "./transition";

export type StartSourcingOutcome =
  | { outcome: "STARTED"; contacted: number; deadline: Date }
  /** Request sudah melewati tahap outreach (retry/resume); pemanggil cukup menunggu. */
  | { outcome: "ALREADY_STARTED" }
  /** Belum ada supplier terverifikasi Telegram untuk barang ini; request tetap DRAFT sampai ada yang terhubung. */
  | { outcome: "NO_REACHABLE_SUPPLIER" }
  /** Semua supplier gagal dihubungi (bot diblokir dsb.); request dibatalkan, tidak dibiarkan menggantung. */
  | { outcome: "CANCELLED_UNREACHABLE" };

const UNREACHABLE_CODES = new Set(["SUPPLIER_UNREACHABLE", "SUPPLIER_NOT_CONNECTED"]);

/**
 * Mulai outreach untuk satu ProcurementRequest (SUPPLIO.md §10 langkah 3). Otomatis: tanpa izin per pesan.
 * Idempotent dan dapat dilanjutkan: sesi dibuat dengan kunci unik (requestId, supplierId), pesan dikirim dengan
 * `idempotencyKey` per sesi, dan transisi status dijaga state machine. Pesan awal memakai template tetap
 * (pembangkit pesan berbasis LLM + AISettings masuk di Fase 4). Restock Budget tidak pernah dikirim ke supplier.
 */
export async function startSourcing(
  db: PrismaClient,
  tg: TelegramClient,
  params: { requestId: string; now?: Date },
): Promise<StartSourcingOutcome> {
  const now = params.now ?? new Date();

  const request = await db.procurementRequest.findUnique({
    where: { id: params.requestId },
    select: {
      id: true,
      businessId: true,
      status: true,
      aiSettingsVersion: true,
      business: { select: { name: true, responseTimeoutMinutes: true } },
      items: {
        select: { productId: true, requiredQuantity: true, maxDeliveryDays: true, product: { select: { name: true, unit: true } } },
      },
    },
  });
  if (!request) throw new DomainError("REQUEST_NOT_FOUND", "Procurement request tidak ditemukan.", 404);
  if (request.status !== "DRAFT" && request.status !== "SOURCING") return { outcome: "ALREADY_STARTED" };

  const productIds = request.items.map((i) => i.productId);

  // Supplier yang boleh dihubungi: aktif, terverifikasi Telegram, menyuplai barang yang diminta,
  // dan tidak sedang dalam sesi aktif lain (satu sesi aktif per chat supplier, §5).
  const suppliers = await db.supplier.findMany({
    where: {
      businessId: request.businessId,
      isActive: true,
      telegramVerifiedAt: { not: null },
      telegramChatId: { not: null },
      products: { some: { productId: { in: productIds } } },
      negotiationSessions: { none: { status: { in: [...ACTIVE_SESSION_STATUSES] }, requestId: { not: request.id } } },
    },
    orderBy: { name: "asc" },
    select: { id: true, products: { where: { productId: { in: productIds } }, select: { productId: true } } },
  });
  if (suppliers.length === 0 && request.status === "DRAFT") return { outcome: "NO_REACHABLE_SUPPLIER" };

  if (request.status === "DRAFT") {
    try {
      await transitionRequest(db, { requestId: request.id, businessId: request.businessId, to: "SOURCING", reason: "Outreach supplier dimulai" });
    } catch (e) {
      if (!(e instanceof DomainError) || e.code !== "STALE_TRANSITION") throw e; // proses lain yang memulai: lanjutkan secara idempoten
    }
  }

  await db.negotiationSession.createMany({
    data: suppliers.map((s) => ({
      requestId: request.id,
      supplierId: s.id,
      businessId: request.businessId,
      aiSettingsVersion: request.aiSettingsVersion,
    })),
    skipDuplicates: true,
  });

  const pending = await db.negotiationSession.findMany({
    where: { requestId: request.id, status: "PENDING" },
    select: { id: true, supplierId: true, supplier: { select: { name: true, products: { select: { productId: true } } } } },
  });

  const expiresAt = new Date(now.getTime() + request.business.responseTimeoutMinutes * 60_000);
  for (const session of pending) {
    const supplied = new Set(session.supplier.products.map((p) => p.productId));
    const items = request.items
      .filter((i) => supplied.has(i.productId))
      .map((i) => ({
        productName: i.product.name,
        quantity: i.requiredQuantity.toString(),
        unit: i.product.unit,
        maxDeliveryDays: i.maxDeliveryDays,
      }));

    try {
      await sendToSupplier(db, tg, {
        supplierId: session.supplierId,
        sessionId: session.id,
        text: buildOutreachMessage({ businessName: request.business.name, supplierName: session.supplier.name, items }),
        idempotencyKey: `session:${session.id}:outreach`,
        sender: "AI",
      });
      await db.negotiationSession.updateMany({
        where: { id: session.id, status: "PENDING" },
        data: { status: "AWAITING_REPLY", lastActivityAt: now, expiresAt },
      });
    } catch (e) {
      const unreachable = e instanceof DomainError && UNREACHABLE_CODES.has(e.code);
      if (!unreachable && !isUniqueViolation(e)) throw e; // galat sementara → biarkan retry (kunci idempotensi mencegah ganda)
      await db.negotiationSession.updateMany({ where: { id: session.id, status: "PENDING" }, data: { status: "TIMED_OUT" } });
    }
  }

  const contacted = await db.negotiationSession.findMany({
    where: { requestId: request.id, status: { in: [...ACTIVE_SESSION_STATUSES] } },
    select: { expiresAt: true },
  });
  if (contacted.length === 0) {
    await transitionRequest(db, {
      requestId: request.id,
      businessId: request.businessId,
      to: "CANCELLED",
      reason: "Tidak ada supplier yang dapat dihubungi lewat Telegram",
    });
    return { outcome: "CANCELLED_UNREACHABLE" };
  }

  await transitionRequest(db, { requestId: request.id, businessId: request.businessId, to: "AWAITING_RESPONSES", reason: "Permintaan penawaran terkirim" });
  const deadline = new Date(Math.max(...contacted.map((s) => s.expiresAt?.getTime() ?? expiresAt.getTime())));
  return { outcome: "STARTED", contacted: contacted.length, deadline };
}

/** Batas tunggu terakhir dari sesi yang aktif; dipakai bila fungsi dilanjutkan setelah retry. */
export async function getSourcingDeadline(db: PrismaClient, requestId: string): Promise<Date | null> {
  const sessions = await db.negotiationSession.findMany({ where: { requestId }, select: { expiresAt: true } });
  const times = sessions.map((s) => s.expiresAt?.getTime()).filter((t): t is number => t !== undefined);
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

/** Semua sesi sudah final (CONFIRMED/DECLINED/TIMED_OUT). Tanpa sesi sama sekali dianggap selesai. */
export async function allSessionsFinished(db: PrismaClient, requestId: string): Promise<boolean> {
  const open = await db.negotiationSession.count({ where: { requestId, status: { notIn: [...FINAL_SESSION_STATUSES] } } });
  return open === 0;
}

export type FinishSourcingOutcome =
  | { outcome: "OPTIMIZED"; requestStatus: OptimizationRun["requestStatus"] }
  | { outcome: "SKIPPED"; status: string };

/**
 * Tutup tahap menunggu (semua sesi selesai atau batas waktu): sesi yang belum membalas ditandai TIMED_OUT
 * dan dikecualikan dari optimasi (tidak dianggap menawar harga referensi, §5 & §10 langkah 5), lalu optimasi dijalankan.
 * Idempotent: status selain AWAITING_RESPONSES/OPTIMIZING dilewati; balapan dengan eksekusi lain → SKIPPED.
 */
export async function finishSourcing(
  db: PrismaClient,
  params: { requestId: string; now?: Date },
): Promise<FinishSourcingOutcome> {
  const request = await db.procurementRequest.findUnique({
    where: { id: params.requestId },
    select: { id: true, businessId: true, status: true },
  });
  if (!request) throw new DomainError("REQUEST_NOT_FOUND", "Procurement request tidak ditemukan.", 404);

  if (request.status === "AWAITING_RESPONSES") {
    try {
      await db.$transaction(async (tx) => {
        await tx.negotiationSession.updateMany({
          where: { requestId: request.id, status: { notIn: [...FINAL_SESSION_STATUSES] } },
          data: { status: "TIMED_OUT" },
        });
        await transitionRequestTx(tx, {
          requestId: request.id,
          businessId: request.businessId,
          to: "OPTIMIZING",
          reason: "Semua sesi selesai atau batas waktu tercapai",
        });
      });
    } catch (e) {
      if (e instanceof DomainError && (e.code === "STALE_TRANSITION" || e.code === "INVALID_TRANSITION")) {
        return { outcome: "SKIPPED", status: "BERUBAH" };
      }
      throw e;
    }
  } else if (request.status !== "OPTIMIZING") {
    return { outcome: "SKIPPED", status: request.status };
  }

  try {
    const run = await runOptimization(db, { businessId: request.businessId, requestId: request.id, now: params.now });
    return { outcome: "OPTIMIZED", requestStatus: run.requestStatus };
  } catch (e) {
    if (e instanceof DomainError && e.code === "REQUEST_NOT_OPTIMIZING") return { outcome: "SKIPPED", status: "SUDAH_DIOPTIMASI" };
    throw e;
  }
}

/** Request di tahap sourcing yang melewati `expiresAt` → EXPIRED; sesi aktifnya ditutup (§9, env expiry 24 jam). */
export async function expireOverdueRequests(db: PrismaClient, now: Date = new Date()): Promise<number> {
  const overdue = await db.procurementRequest.findMany({
    where: { expiresAt: { lte: now }, status: { in: [...SOURCING_ACTIVE_STATUSES] } },
    select: { id: true, businessId: true },
  });

  let expired = 0;
  for (const r of overdue) {
    try {
      await db.$transaction(async (tx) => {
        await tx.negotiationSession.updateMany({
          where: { requestId: r.id, status: { notIn: [...FINAL_SESSION_STATUSES] } },
          data: { status: "TIMED_OUT" },
        });
        await transitionRequestTx(tx, { requestId: r.id, businessId: r.businessId, to: "EXPIRED", reason: "Melewati masa berlaku request" });
      });
      expired++;
    } catch (e) {
      if (!(e instanceof DomainError)) throw e; // status berubah di tengah jalan: biarkan, dicek lagi pada putaran berikutnya
    }
  }
  return expired;
}
