"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";

type SupplierSummary = { supplierName: string; itemCount: number; subtotal: number };
type Mode = "approve" | "reject";

/**
 * Final Approval (SUPPLIO.md §4.3, §10 langkah 7). Hanya aksi pemilik; di sini tidak ada yang dijalankan otomatis.
 * Satu kunci idempotensi per rekomendasi (komponen di-key oleh recommendationId): klik ganda tidak membuat PO ganda.
 */
export function ApprovalPanel(props: {
  requestId: string;
  recommendationId: string;
  totalCost: number;
  remainingBudget: number;
  suppliers: SupplierSummary[];
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [busy, setBusy] = useState<Mode | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const key = useRef<string>(crypto.randomUUID());
  const dialog = useRef<HTMLDialogElement>(null);

  const done = () => startTransition(() => router.refresh());

  function open(next: Mode) {
    setMode(next);
    setReason("");
    dialog.current?.showModal();
  }

  function close() {
    dialog.current?.close();
    setMode(null);
  }

  async function approve() {
    close();
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
    const trimmed = reason.trim();
    close();
    setBusy("reject");
    setError(null);
    setInfo(null);
    try {
      await apiRequest(`/api/procurement/${props.requestId}/reject`, "POST", { reason: trimmed || undefined });
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
        <Button type="button" size="lg" onClick={() => open("approve")} disabled={disabled}>
          {busy === "approve" ? "Memproses…" : "Setujui pembelian"}
        </Button>
        <Button type="button" variant="destructive" size="lg" onClick={() => open("reject")} disabled={disabled}>
          {busy === "reject" ? "Memproses…" : "Tolak dan batalkan"}
        </Button>
      </div>
      <FormMessage error={error} info={info} />

      <dialog
        ref={dialog}
        onClose={() => setMode(null)}
        aria-labelledby="approval-dialog-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface-raised p-0 text-foreground shadow-xl backdrop:bg-blue-950/40"
      >
        {mode === "approve" ? (
          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <h2 id="approval-dialog-title" className="text-lg font-medium">
                Setujui pembelian {formatRupiah(props.totalCost)}?
              </h2>
              <p className="text-sm text-muted-foreground">
                Purchase order dibuat per supplier dan konfirmasi pesanan dikirim lewat Telegram. Stok baru bertambah saat
                barang diterima.
              </p>
            </div>
            <ul className="flex flex-col divide-y rounded-xl border text-sm">
              {props.suppliers.map((s) => (
                <li key={s.supplierName} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>
                    <span className="font-medium">{s.supplierName}</span>{" "}
                    <span className="text-muted-foreground">({s.itemCount} barang, termasuk ongkir)</span>
                  </span>
                  <span className="tabular-nums">{formatRupiah(s.subtotal)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 bg-surface-sunken px-3 py-2 text-muted-foreground">
                <span>Sisa Restock Budget</span>
                <span className="tabular-nums">{formatRupiah(props.remainingBudget)}</span>
              </li>
            </ul>
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={close}>
                Kembali
              </Button>
              <Button type="button" onClick={approve}>
                Ya, setujui
              </Button>
            </div>
          </div>
        ) : null}
        {mode === "reject" ? (
          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <h2 id="approval-dialog-title" className="text-lg font-medium">
                Tolak rekomendasi dan batalkan request?
              </h2>
              <p className="text-sm text-muted-foreground">Tidak ada pesanan yang dibuat. Tindakan ini tidak bisa diurungkan.</p>
            </div>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium leading-none">Alasan (opsional)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                rows={3}
                className="w-full rounded-xl border border-input bg-surface-raised px-3.5 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 md:text-sm"
              />
            </label>
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={close}>
                Kembali
              </Button>
              <Button type="button" variant="destructive" onClick={reject}>
                Tolak dan batalkan
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
