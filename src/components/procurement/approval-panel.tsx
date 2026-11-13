"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";

/**
 * Final Approval (SUPPLIO.md §4.3, §10 langkah 7). Hanya aksi pemilik; di sini tidak ada yang dijalankan otomatis.
 * Satu kunci idempotensi per rekomendasi (komponen di-key oleh recommendationId): klik ganda tidak membuat PO ganda.
 */
export function ApprovalPanel(props: { requestId: string; recommendationId: string; totalCost: number; supplierCount: number }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const key = useRef<string>(crypto.randomUUID());

  const done = () => startTransition(() => router.refresh());

  async function approve() {
    if (
      !window.confirm(
        `Setujui pembelian senilai ${formatRupiah(props.totalCost)} dari ${props.supplierCount} supplier?\n\n` +
          "Purchase order akan dibuat dan konfirmasi pesanan dikirim ke supplier lewat Telegram.",
      )
    ) {
      return;
    }
    setBusy("approve");
    setError(null);
    setInfo(null);
    try {
      const result = await apiRequest<{ outcome: string; orders: { poNumber: string }[] }>(`/api/procurement/${props.requestId}/approve`, "POST", {
        recommendationId: props.recommendationId,
        idempotencyKey: key.current,
      });
      setInfo(`Disetujui. PO dibuat: ${result.orders.map((o) => o.poNumber).join(", ")}.`);
      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyetujui.");
      done(); // data bisa berubah (rekomendasi dihitung ulang): tampilkan keadaan terbaru
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (!window.confirm("Tolak rekomendasi ini dan batalkan request? Tidak ada pesanan yang dibuat.")) return;
    const reason = window.prompt("Alasan (opsional):") ?? undefined;
    setBusy("reject");
    setError(null);
    setInfo(null);
    try {
      await apiRequest(`/api/procurement/${props.requestId}/reject`, "POST", { reason: reason?.trim() || undefined });
      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menolak.");
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null || refreshing;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={approve} disabled={disabled}>
          {busy === "approve" ? "Memproses…" : "Setujui pembelian"}
        </Button>
        <Button type="button" variant="outline" onClick={reject} disabled={disabled}>
          Tolak / batalkan
        </Button>
      </div>
      <FormMessage error={error} info={info} />
    </div>
  );
}
