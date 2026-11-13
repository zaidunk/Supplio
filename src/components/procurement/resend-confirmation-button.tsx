"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";

/** Kirim (ulang) konfirmasi order untuk PO yang belum terkirim. Idempoten: tidak mengirim pesan kedua. */
export function ResendConfirmationButton({ purchaseOrderId }: { purchaseOrderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiRequest<{ sent: number; failed: { reason: string }[] }>(`/api/purchase-orders/${purchaseOrderId}/send`, "POST");
      setMessage(r.sent > 0 ? "Konfirmasi terkirim." : (r.failed[0]?.reason ?? "Tidak ada yang dikirim."));
      startTransition(() => router.refresh());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal mengirim.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" onClick={send} disabled={busy || pending}>
        Kirim konfirmasi ke supplier
      </Button>
      {message ? <p className="max-w-64 text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
