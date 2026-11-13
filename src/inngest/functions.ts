import { RetryAfterError } from "inngest";
import { z } from "zod";
import { handleSupplierMessage } from "@/lib/ai/agent";
import { classifyLlmError } from "@/lib/ai/rate-limit";
import { getModelFactory } from "@/lib/ai/server";
import { prisma } from "@/lib/db/prisma";
import type { AppEvent } from "@/lib/events";
import {
  allSessionsFinished,
  expireOverdueRequests,
  finishSourcing,
  getSourcingDeadline,
  startSourcing,
} from "@/lib/procurement/sourcing";
import { sendOrderConfirmations } from "@/lib/procurement/orders";
import { markUpdateProcessed, processTelegramUpdate } from "@/lib/telegram/process-update";
import { getTelegramClient } from "@/lib/telegram/server";
import { inngest } from "./client";

/**
 * Fungsi durable (SUPPLIO.md §7): tipis, hanya memanggil service di `src/lib` yang sudah idempotent dan teruji.
 * Event dari supplier/webhook dapat datang terlambat atau berulang; keamanan data dijaga service, bukan urutan event.
 */
const toEvent = (e: AppEvent) => ({ name: e.name, data: e.data });

const updateEvent = z.object({ updateId: z.number().int() });
const requestEvent = z.object({ requestId: z.string(), businessId: z.string() });
const connectedEvent = z.object({ supplierId: z.string(), businessId: z.string() });
const messageEvent = z.object({ messageId: z.string() });

/** Maksimum siklus tunggu `session.finished` per request (jumlah sesi kecil pada MVP). */
const MAX_WAIT_CYCLES = 50;

/** Proses update Telegram tersimpan: onboarding, korelasi sesi, penyimpanan pesan. */
export const processTelegramUpdateFn = inngest.createFunction(
  { id: "process-telegram-update", retries: 5, triggers: [{ event: "telegram/update.received" }] },
  async ({ event, step }) => {
    const { updateId } = updateEvent.parse(event.data);
    const result = await step.run("process", () => processTelegramUpdate(prisma, getTelegramClient(), updateId));
    if (result.events.length > 0) await step.sendEvent("emit-events", result.events.map(toEvent));
    await step.run("mark-processed", () => markUpdateProcessed(prisma, updateId));
    return { status: result.status };
  },
);

/**
 * Jaring pengaman: update yang tersimpan tetapi belum diproses (Inngest sempat tidak terjangkau) dan request DRAFT
 * baru yang event pembuatannya hilang dikirim ulang. Id event memuat ember menit agar tidak terdedup oleh id lama.
 */
export const redispatchStaleFn = inngest.createFunction(
  { id: "redispatch-stale", triggers: [{ cron: "* * * * *" }] },
  async ({ step }) => {
    const events = await step.run("find-stale", async () => {
      const now = Date.now();
      const bucket = Math.floor(now / 60_000);

      const updates = await prisma.telegramUpdate.findMany({
        where: { processedAt: null, receivedAt: { lt: new Date(now - 60_000) } },
        orderBy: { receivedAt: "asc" },
        take: 50,
        select: { updateId: true },
      });
      // Hanya DRAFT yang masih baru: DRAFT yang menunggu supplier terhubung dilanjutkan oleh event telegram.connected.
      const drafts = await prisma.procurementRequest.findMany({
        where: {
          status: "DRAFT",
          createdAt: { gt: new Date(now - 10 * 60_000), lt: new Date(now - 120_000) },
          sessions: { none: {} },
        },
        take: 20,
        select: { id: true, businessId: true },
      });

      return [
        ...updates.map((u) => ({
          id: `tg-${u.updateId}-r${bucket}`,
          name: "telegram/update.received" as const,
          data: { updateId: Number(u.updateId) },
        })),
        ...drafts.map((d) => ({
          id: `req-${d.id}-r${bucket}`,
          name: "procurement/request.created" as const,
          data: { requestId: d.id, businessId: d.businessId },
        })),
      ];
    });
    if (events.length > 0) await step.sendEvent("redispatch", events);
    return { redispatched: events.length };
  },
);

/**
 * Orkestrasi satu request: outreach → tunggu balasan sampai semua sesi selesai atau batas waktu → optimasi.
 * Satu request diproses satu per satu (concurrency key); eksekusi kedua melihat status lanjut dan lewat.
 */
export const sourceRequestFn = inngest.createFunction(
  {
    id: "source-request",
    retries: 3,
    concurrency: { limit: 1, key: "event.data.requestId" },
    triggers: [{ event: "procurement/request.created" }],
  },
  async ({ event, step }) => {
    const { requestId } = requestEvent.parse(event.data);

    const started = await step.run("start-sourcing", async () => {
      const r = await startSourcing(prisma, getTelegramClient(), { requestId });
      return { outcome: r.outcome, deadline: r.outcome === "STARTED" ? r.deadline.toISOString() : null };
    });
    if (started.outcome === "NO_REACHABLE_SUPPLIER" || started.outcome === "CANCELLED_UNREACHABLE") return started;

    let deadlineIso =
      started.deadline ??
      (await step.run("get-deadline", async () => (await getSourcingDeadline(prisma, requestId))?.toISOString() ?? null));
    if (!deadlineIso) return started;

    for (let i = 0; i < MAX_WAIT_CYCLES; i++) {
      if (await step.run(`check-sessions-${i}`, () => allSessionsFinished(prisma, requestId))) break;
      const finished = await step.waitForEvent(`wait-session-finished-${i}`, {
        event: "procurement/session.finished",
        timeout: new Date(deadlineIso),
        match: "data.requestId",
      });
      if (finished !== null) continue; // ada sesi selesai: periksa lagi apakah semua sudah selesai

      // Batas waktu tercapai. Agen memperpanjang batas sesi yang sedang menunggu jawaban klarifikasi/counter-offer,
      // jadi baca ulang sebelum menutup (perbandingan antar-tanggal saja, deterministik saat replay).
      const latest = await step.run(`recheck-deadline-${i}`, async () => (await getSourcingDeadline(prisma, requestId))?.toISOString() ?? null);
      if (!latest || new Date(latest).getTime() <= new Date(deadlineIso).getTime()) break;
      deadlineIso = latest;
    }

    return step.run("finish-sourcing", () => finishSourcing(prisma, { requestId }));
  },
);

/**
 * Giliran agen untuk satu balasan supplier (LangChain + Gemini). Dijalankan di worker, bukan di webhook (§5).
 * Satu sesi diproses satu per satu (urutan pesan terjaga). Bila gagal sementara (mis. model/jaringan), Inngest
 * mengulang; giliran bersifat idempoten sehingga tidak ada balasan atau penawaran ganda.
 */
export const handleSupplierMessageFn = inngest.createFunction(
  {
    id: "handle-supplier-message",
    // Lebih longgar karena kuota LLM (terutama Free Tier) sering habis; tiap retry menunggu sesuai petunjuk penyedia.
    retries: 6,
    concurrency: { limit: 1, key: "event.data.sessionId" },
    triggers: [{ event: "supplier/message.received" }],
  },
  async ({ event, step }) => {
    const { messageId } = messageEvent.parse(event.data);
    const result = await step.run("agent-turn", async () => {
      try {
        return await handleSupplierMessage(prisma, getTelegramClient(), getModelFactory(), { messageId });
      } catch (e) {
        // 429/503 dari LLM: tunggu sesuai petunjuk penyedia, bukan retry cepat. Giliran idempoten, jadi aman diulang.
        const transient = classifyLlmError(e);
        if (transient) {
          throw new RetryAfterError(`LLM ${transient.reason}: menunggu sebelum mencoba lagi`, transient.retryAfterMs, { cause: e });
        }
        throw e;
      }
    });
    if (result.events.length > 0) await step.sendEvent("emit-events", result.events.map(toEvent));
    return { status: result.status, reason: result.reason ?? null, sessionStatus: result.sessionStatus ?? null };
  },
);


/**
 * Setelah Final Approval (PO sudah sah): kirim konfirmasi pemesanan dengan nomor PO ke tiap supplier (§4.3).
 * Idempoten per PO. Supplier yang tidak terjangkau tidak membatalkan PO; PO tetap CREATED dan owner dapat mengirim ulang.
 */
export const sendOrderConfirmationsFn = inngest.createFunction(
  { id: "send-order-confirmations", retries: 5, triggers: [{ event: "procurement/approved" }] },
  async ({ event, step }) => {
    const { requestId, businessId } = requestEvent.parse(event.data);
    return step.run("send", () => sendOrderConfirmations(prisma, getTelegramClient(), { businessId, requestId }));
  },
);

/** Supplier baru terhubung: lanjutkan request DRAFT yang tadinya tidak punya supplier terjangkau. */
export const resumeSourcingAfterConnectFn = inngest.createFunction(
  { id: "resume-sourcing-after-connect", triggers: [{ event: "supplier/telegram.connected" }] },
  async ({ event, step }) => {
    const { businessId } = connectedEvent.parse(event.data);
    const drafts = await step.run("find-drafts", () =>
      prisma.procurementRequest.findMany({ where: { businessId, status: "DRAFT" }, select: { id: true } }),
    );
    if (drafts.length > 0) {
      await step.sendEvent(
        "resume",
        drafts.map((d) => ({
          id: `req-${d.id}-after-${event.id}`,
          name: "procurement/request.created" as const,
          data: { requestId: d.id, businessId },
        })),
      );
    }
    return { resumed: drafts.length };
  },
);

/** Request yang melewati masa berlaku (default 24 jam, env) → EXPIRED. */
export const expireRequestsFn = inngest.createFunction(
  { id: "expire-requests", triggers: [{ cron: "*/10 * * * *" }] },
  async ({ step }) => ({ expired: await step.run("expire", () => expireOverdueRequests(prisma)) }),
);

export const functions = [
  processTelegramUpdateFn,
  redispatchStaleFn,
  sourceRequestFn,
  handleSupplierMessageFn,
  sendOrderConfirmationsFn,
  resumeSourcingAfterConnectFn,
  expireRequestsFn,
];
