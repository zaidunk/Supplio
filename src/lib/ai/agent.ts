import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type AIMessage,
  type AIMessageChunk,
  type BaseMessage,
} from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { NegotiationStatus, PrismaClient } from "@/generated/prisma/client";
import type { AppEvent } from "@/lib/events";
import { ACTIVE_SESSION_STATUSES } from "@/lib/procurement/sessions";
import type { TelegramClient } from "@/lib/telegram/client";
import { HISTORY_LIMIT, MAX_MODEL_STEPS, MODEL_TIMEOUT_MS } from "./constants";
import { buildProcurementContext, otherSupplierNames } from "./context";
import { CLOSING_MESSAGES, SAFE_FALLBACKS, buildClarificationFallback, type MessageKind } from "./guard";
import { buildSystemPrompt, buildTurnPrompt } from "./prompts";
import { findQuotationForMessage } from "./quotation";
import { createAgentTools, newTurnState, sendTurnMessage, turnKeyPrefix, type ToolDeps, type TurnState } from "./tools";

/** Model berkemampuan tool-calling yang sudah di-bind ke tool giliran ini (Gemini di produksi, model palsu di tes). */
export interface AgentRunnable {
  invoke(messages: BaseMessage[]): Promise<AIMessage | AIMessageChunk>;
}
export type AgentModelFactory = (tools: StructuredToolInterface[]) => AgentRunnable;

export interface TurnResult {
  status: "SKIPPED" | "HANDLED";
  reason?: string;
  sessionStatus?: NegotiationStatus;
  /** Event lanjutan yang harus dikirim pemanggil setelah giliran selesai. */
  events: AppEvent[];
}

const skipped = (reason: string): TurnResult => ({ status: "SKIPPED", reason, events: [] });

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Model tidak merespons dalam ${ms} ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Satu giliran agen untuk satu pesan supplier (SUPPLIO.md §5, §6, §10 langkah 4). Berjalan di worker Inngest, bukan
 * di webhook. Idempoten: pesan yang sama tidak menghasilkan dua balasan atau dua penawaran bila giliran diulang.
 *
 * Pembagian tugas: model memahami bahasa natural dan menyusun pesan; KODE menentukan apa yang boleh terjadi
 * (jatah counter-offer/klarifikasi, penjaga pesan, status penawaran, dan status sesi).
 */
export async function handleSupplierMessage(
  db: PrismaClient,
  tg: TelegramClient,
  modelFactory: AgentModelFactory,
  params: { messageId: string; now?: Date },
): Promise<TurnResult> {
  const now = params.now ?? new Date();

  const message = await db.conversationMessage.findUnique({
    where: { id: params.messageId },
    select: { id: true, direction: true, sender: true, content: true, sessionId: true, supplierId: true },
  });
  if (!message || message.direction !== "INBOUND" || message.sender !== "SUPPLIER" || !message.sessionId) {
    return skipped("BUKAN_PESAN_SUPPLIER_DALAM_SESI");
  }

  const session = await db.negotiationSession.findUnique({
    where: { id: message.sessionId },
    select: {
      id: true,
      requestId: true,
      businessId: true,
      supplierId: true,
      status: true,
      aiSettingsVersion: true,
      business: { select: { responseTimeoutMinutes: true } },
    },
  });
  if (!session || session.supplierId !== message.supplierId) return skipped("SESI_TIDAK_COCOK");
  if (!(ACTIVE_SESSION_STATUSES as readonly string[]).includes(session.status)) return skipped("SESI_TIDAK_AKTIF");

  const ids = { businessId: session.businessId, requestId: session.requestId, sessionId: session.id };
  const ctx = await buildProcurementContext(db, ids);
  const state = newTurnState();
  const deps: ToolDeps = {
    db,
    tg,
    ids,
    supplierId: session.supplierId,
    sourceMessageId: message.id,
    now,
    responseTimeoutMinutes: session.business.responseTimeoutMinutes,
    guard: {
      restockBudget: ctx.confidential.restockBudget,
      maximumUnitPrices: ctx.confidential.maximumUnitPriceByProduct.map((m) => m.maximumUnitPrice),
      otherSupplierNames: await otherSupplierNames(db, ids, session.supplierId),
    },
    state,
  };

  // Giliran ini pernah diproses (retry)? Jangan memanggil model lagi, cukup selesaikan status secara idempoten.
  const priorOutbound = await db.conversationMessage.findFirst({
    where: { idempotencyKey: { startsWith: turnKeyPrefix(session.id, message.id) } },
    select: { idempotencyKey: true, content: true },
  });
  const priorQuotation = await findQuotationForMessage(db, session.id, message.id);

  if (priorOutbound) {
    const kind = priorOutbound.idempotencyKey?.split(":out:")[1] as MessageKind | undefined;
    state.outbound = { kind: kind ?? "REPLY", text: priorOutbound.content };
    state.quotation = priorQuotation;
    state.declinedAll = priorQuotation?.status === "REJECTED";
  } else {
    const aiSettings = await db.aISettings.findUnique({
      where: { businessId_version: { businessId: session.businessId, version: session.aiSettingsVersion } },
      select: { communicationTone: true, negotiationStyle: true, customInstructions: true },
    });
    const history = await db.conversationMessage.findMany({
      where: { sessionId: session.id, id: { not: message.id } },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: { sender: true, content: true },
    });

    const tools = createAgentTools(deps);
    await runModelLoop(modelFactory, tools, [
      new SystemMessage(
        buildSystemPrompt({
          communicationTone: aiSettings?.communicationTone ?? "ramah dan sopan",
          negotiationStyle: aiSettings?.negotiationStyle ?? "santun, tegas pada harga",
          customInstructions: aiSettings?.customInstructions ?? "",
        }),
      ),
      new HumanMessage(
        buildTurnPrompt({
          contextJson: JSON.stringify(ctx),
          history: history.reverse(),
          latestSupplierMessage: message.content,
        }),
      ),
    ]);
  }

  const { sessionStatus, events } = await finalizeSession(deps);
  return { status: "HANDLED", sessionStatus, events };
}

/** Loop model ↔ tool dengan batas langkah. Hanya tool yang terdaftar yang bisa dijalankan; sisanya ditolak. */
async function runModelLoop(modelFactory: AgentModelFactory, tools: StructuredToolInterface[], initial: BaseMessage[]): Promise<void> {
  const byName = new Map(tools.map((t) => [t.name, t]));
  const runnable = modelFactory(tools);
  const messages = [...initial];

  for (let step = 0; step < MAX_MODEL_STEPS; step++) {
    const ai = await withTimeout(runnable.invoke(messages), MODEL_TIMEOUT_MS);
    messages.push(ai);

    const calls = ai.tool_calls ?? [];
    if (calls.length === 0) return;

    for (const [index, call] of calls.entries()) {
      const target = byName.get(call.name);
      let content: string;
      if (!target) {
        // Mis. instruksi jahat yang menyuruh memanggil approvePurchase/updateRestockBudget: tool itu tidak ada.
        content = JSON.stringify({ ok: false, error: `Tool "${call.name}" tidak tersedia.` });
      } else {
        try {
          const out = await target.invoke(call.args);
          content = typeof out === "string" ? out : JSON.stringify(out);
        } catch (e) {
          content = JSON.stringify({ ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "Tool gagal." });
        }
      }
      messages.push(new ToolMessage({ content, tool_call_id: call.id ?? `${call.name}-${step}-${index}`, name: call.name }));
    }
  }
}

/**
 * Status sesi ditentukan KODE dari hasil tool, bukan dari kata-kata model:
 *  - klarifikasi/counter-offer terkirim → CLARIFYING/NEGOTIATING (diatur saat pengiriman);
 *  - supplier menolak → DECLINED; penawaran lengkap tersimpan dan tidak ada pertanyaan tertunda → CONFIRMED;
 *  - tidak ada jalan maju (jatah klarifikasi habis) → ditutup (CONFIRMED bila ada penawaran sah sebelumnya, selain itu TIMED_OUT).
 */
async function finalizeSession(deps: ToolDeps): Promise<{ sessionStatus: NegotiationStatus; events: AppEvent[] }> {
  const { db, ids, state, now } = deps;
  const confirmed = await db.quotation.count({ where: { sessionId: ids.sessionId, status: "CONFIRMED" } });
  let giveUp = false;

  // Penawaran belum jelas tetapi model tidak bertanya → kode yang bertanya, dari daftar kekurangan yang pasti.
  if (state.quotation?.status === "NEEDS_CLARIFICATION" && !state.outbound) {
    const sent = await sendTurnMessage(deps, "CLARIFICATION", buildClarificationFallback(state.quotation.missing), {
      trusted: true,
      clarificationMissing: state.quotation.missing,
    });
    if (!sent.ok) giveUp = true;
  } else if (!state.outbound && !state.quotation && confirmed === 0 && !state.declinedAll) {
    // Model tidak melakukan apa-apa: minta supplier menjelaskan, daripada diam.
    const sent = await sendTurnMessage(deps, "CLARIFICATION", SAFE_FALLBACKS.CLARIFICATION, { trusted: true });
    if (!sent.ok) giveUp = true;
  }

  let target: NegotiationStatus | null = null;
  let closing: string | null = null;
  if (state.declinedAll) {
    target = "DECLINED";
    closing = state.outbound ? null : CLOSING_MESSAGES.DECLINED;
  } else if (giveUp) {
    target = confirmed > 0 ? "CONFIRMED" : "TIMED_OUT";
    closing = CLOSING_MESSAGES.GIVE_UP;
  } else if ((!state.outbound || state.outbound.kind === "REPLY") && confirmed > 0) {
    target = "CONFIRMED";
    closing = state.outbound ? null : CLOSING_MESSAGES.CONFIRMED;
  }

  const events: AppEvent[] = [];
  if (target) {
    if (closing) {
      // Penutup sopan dikirim kode (konstan, aman). Kegagalan kirim (mis. bot diblokir) tidak boleh menahan penutupan sesi.
      try {
        await sendTurnMessage(deps, "REPLY", closing, { trusted: true });
      } catch {
        /* sesi tetap ditutup */
      }
    }
    const updated = await db.negotiationSession.updateMany({
      where: { id: ids.sessionId, status: { in: [...ACTIVE_SESSION_STATUSES] } },
      data: { status: target, lastActivityAt: now },
    });
    if (updated.count > 0) {
      events.push({ name: "procurement/session.finished", data: { requestId: ids.requestId, sessionId: ids.sessionId } });
    }
  }

  const after = await db.negotiationSession.findUniqueOrThrow({ where: { id: ids.sessionId }, select: { status: true } });
  return { sessionStatus: after.status, events };
}

export type { TurnState };
