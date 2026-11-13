/** Kontrak event antar komponen (diteruskan melalui Inngest). Hanya id dan primitif; tidak ada data sensitif. */
export type AppEvent =
  | { name: "telegram/update.received"; data: { updateId: number } }
  | { name: "procurement/request.created"; data: { requestId: string; businessId: string } }
  | { name: "procurement/session.finished"; data: { requestId: string; sessionId: string } }
  | {
      name: "supplier/message.received";
      data: { messageId: string; sessionId: string; supplierId: string; businessId: string; requestId: string };
    }
  | { name: "supplier/telegram.connected"; data: { supplierId: string; businessId: string } }
  /** Final Approval selesai dan PO sudah sah: kirim konfirmasi order ke supplier (§4.3). */
  | { name: "procurement/approved"; data: { requestId: string; businessId: string } };

export type AppEventName = AppEvent["name"];
