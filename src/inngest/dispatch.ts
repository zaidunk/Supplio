import "server-only";
import type { AppEvent } from "@/lib/events";
import type { EvaluateOutcome } from "@/lib/procurement/trigger";
import { inngest } from "./client";

/** Kirim event; kegagalan hanya dicatat. Pemanggil API tidak boleh gagal karena Inngest sedang tidak terjangkau. */
export async function dispatchEvents(events: (AppEvent & { id?: string })[]): Promise<boolean> {
  if (events.length === 0) return true;
  try {
    await inngest.send(events);
    return true;
  } catch (e) {
    console.error("[inngest] gagal mengirim event:", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
    return false;
  }
}

/**
 * Final Approval selesai dan PO sudah sah → kirim konfirmasi order. Id event = id request (terdedup). Mengembalikan
 * false bila Inngest tidak terjangkau; pemanggil lalu mengirim langsung lewat jalur cadangan.
 */
export async function dispatchApproved(requestId: string, businessId: string): Promise<boolean> {
  return dispatchEvents([{ id: `approved-${requestId}`, name: "procurement/approved", data: { requestId, businessId } }]);
}

/**
 * Request restock baru (otomatis, tanpa persetujuan) → mulai sourcing. Bila pengiriman gagal, request tetap DRAFT dan
 * dikirim ulang oleh fungsi `redispatch-stale`. Id event = id request, sehingga pengiriman ganda terdedup.
 */
export async function dispatchTriggerOutcome(outcome: EvaluateOutcome, businessId: string): Promise<void> {
  if (outcome.outcome !== "CREATED") return;
  await dispatchEvents([
    { id: `req-${outcome.requestId}`, name: "procurement/request.created", data: { requestId: outcome.requestId, businessId } },
  ]);
}
