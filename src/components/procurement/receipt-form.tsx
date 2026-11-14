"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatQty } from "@/lib/format";
import type { EvaluateOutcome } from "@/lib/procurement/trigger";
import { describeTrigger } from "@/lib/ui/status";

interface ReceiptItem {
  productId: string;
  productName: string;
  unit: string;
  outstanding: string;
}

/** Pesan kesalahan untuk satu baris, atau null bila kosong/valid. Aturan akhir tetap ditegakkan server. */
function validate(raw: string, item: ReceiptItem): string | null {
  const text = raw.trim().replace(",", ".");
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return "Isi dengan angka.";
  if (n < 0) return "Tidak boleh negatif.";
  if (n > Number(item.outstanding)) return `Melebihi sisa pesanan (${formatQty(item.outstanding)} ${item.unit}).`;
  return null;
}

/**
 * Catat barang yang BENAR-BENAR diterima (parsial atau penuh). Stok bertambah sebesar jumlah yang diisi, tidak lebih
 * dari sisa pesanan. Kunci idempotensi dipertahankan sampai berhasil: klik ganda/retry jaringan tidak menambah stok dua kali.
 */
export function ReceiptForm({ purchaseOrderId, items }: { purchaseOrderId: string; items: ReceiptItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const key = useRef<string>(crypto.randomUUID());

  const open = items.filter((i) => Number(i.outstanding) > 0);
  if (open.length === 0) return null;

  const errors = Object.fromEntries(open.map((i) => [i.productId, validate(values[i.productId] ?? "", i)]));
  const hasErrors = Object.values(errors).some(Boolean);

  function receiveAll() {
    setValues(Object.fromEntries(open.map((i) => [i.productId, i.outstanding])));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const payload = open
      .map((i) => ({ productId: i.productId, receivedQuantity: (values[i.productId] ?? "").trim().replace(",", ".") }))
      .filter((i) => i.receivedQuantity !== "" && Number(i.receivedQuantity) !== 0);
    if (payload.length === 0) {
      setError("Isi jumlah yang diterima untuk minimal satu barang.");
      return;
    }
    setBusy(true);
    try {
      const r = await apiRequest<{ purchaseOrderStatus: string; trigger: EvaluateOutcome | null }>(`/api/purchase-orders/${purchaseOrderId}/receipts`, "POST", {
        items: payload,
        idempotencyKey: key.current,
      });
      key.current = crypto.randomUUID(); // berhasil → penerimaan berikutnya adalah tindakan baru
      setValues({});
      setInfo((r.trigger && describeTrigger(r.trigger)) ?? (r.purchaseOrderStatus === "RECEIVED" ? "Tercatat. PO diterima penuh." : "Tercatat. Penerimaan sebagian."));
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencatat penerimaan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Catat penerimaan</p>
        {open.length > 1 ? (
          <Button type="button" variant="outline" size="sm" onClick={receiveAll}>
            Terima semua barang
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {open.map((i) => {
          const err = errors[i.productId];
          const errorId = `receipt-${purchaseOrderId}-${i.productId}-error`;
          return (
            <label key={i.productId} className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium leading-none">
                {i.productName} <span className="font-normal text-muted-foreground">(sisa {formatQty(i.outstanding)} {i.unit})</span>
              </span>
              <div className="flex gap-2">
                <Input
                  inputMode="decimal"
                  placeholder="0"
                  value={values[i.productId] ?? ""}
                  aria-invalid={err ? true : undefined}
                  aria-describedby={err ? errorId : undefined}
                  onChange={(e) => setValues((v) => ({ ...v, [i.productId]: e.target.value }))}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setValues((v) => ({ ...v, [i.productId]: i.outstanding }))}>
                  Terima semua
                </Button>
              </div>
              {err ? (
                <span id={errorId} role="alert" className="text-xs text-destructive">
                  {err}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      <FormMessage error={error} info={info} />
      <div>
        <Button type="submit" disabled={busy || pending || hasErrors}>
          Simpan penerimaan
        </Button>
      </div>
    </form>
  );
}
