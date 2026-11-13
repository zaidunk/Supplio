"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormMessage } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiRequest } from "@/lib/api-client";
import { formatQty } from "@/lib/format";
import type { InventoryRow } from "@/lib/inventory/overview";

type Row = Pick<
  InventoryRow,
  | "id"
  | "name"
  | "unit"
  | "currentStock"
  | "incomingQuantity"
  | "suggestedQuantity"
  | "plannedLeadTimeDays"
  | "activeSupplierCount"
  | "triggerRestock"
  | "stockoutRisk"
  | "daysOfCover"
  | "inActiveRequest"
>;

type Selection = { quantity: string; maxDeliveryDays: string };

/** Owner meminta penawaran untuk barang pilihan, tanpa menunggu ambang restock (SUPPLIO.md §4.1). */
export function RequestQuotePanel({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, Selection>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedBySourcing, setBlockedBySourcing] = useState(false);
  // Satu kunci per percobaan kirim: klik ganda/retry jaringan tidak menggandakan request.
  const attemptKey = useRef<string>(crypto.randomUUID());

  const selectedRows = rows.filter((r) => selected[r.id]);
  const eligible = (r: Row) => r.activeSupplierCount > 0;

  function toggle(row: Row) {
    setSelected((cur) => {
      const next = { ...cur };
      if (next[row.id]) delete next[row.id];
      else next[row.id] = { quantity: row.suggestedQuantity ?? "", maxDeliveryDays: String(row.plannedLeadTimeDays ?? "") };
      return next;
    });
  }

  function selectNeedRestock() {
    const next: Record<string, Selection> = {};
    for (const r of rows) {
      if (r.triggerRestock && eligible(r) && !r.inActiveRequest) {
        next[r.id] = { quantity: r.suggestedQuantity ?? "", maxDeliveryDays: String(r.plannedLeadTimeDays ?? "") };
      }
    }
    setSelected(next);
  }

  function update(id: string, patch: Partial<Selection>) {
    setSelected((cur) => (cur[id] ? { ...cur, [id]: { ...cur[id], ...patch } } : cur));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBlockedBySourcing(false);
    setPending(true);
    try {
      const { requestId } = await apiRequest<{ requestId: string }>("/api/procurement", "POST", {
        clientKey: attemptKey.current,
        items: selectedRows.map((r) => {
          const s = selected[r.id];
          return {
            productId: r.id,
            quantity: s.quantity.trim(),
            ...(s.maxDeliveryDays.trim() !== "" ? { maxDeliveryDays: Number(s.maxDeliveryDays) } : {}),
          };
        }),
      });
      attemptKey.current = crypto.randomUUID();
      router.push(`/procurement/${requestId}`);
    } catch (err) {
      setBlockedBySourcing(err instanceof ApiError && err.code === "ACTIVE_SOURCING_EXISTS");
      setError(err instanceof Error ? err.message : "Gagal membuat permintaan penawaran.");
      setPending(false);
    }
  }

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Belum ada produk.</p>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={selectNeedRestock}>
          Pilih yang perlu restock
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSelected({})} disabled={selectedRows.length === 0}>
          Kosongkan pilihan
        </Button>
      </div>

      <ul className="flex flex-col divide-y rounded-md border">
        {rows.map((r) => {
          const s = selected[r.id];
          const hasIncoming = Number(r.incomingQuantity) > 0;
          return (
            <li key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
              <label className="flex min-w-0 flex-1 items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(s)}
                  disabled={!eligible(r) || pending}
                  onChange={() => toggle(r)}
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">
                    {r.name} <span className="text-muted-foreground">({r.unit})</span>
                    <span className="ml-2 font-normal text-muted-foreground">stok {formatQty(r.currentStock)}</span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {!eligible(r) ? <Badge variant="destructive">Belum ada supplier aktif</Badge> : null}
                    {r.triggerRestock ? <Badge>Perlu restock</Badge> : null}
                    {r.inActiveRequest ? <Badge variant="secondary">Sedang diproses</Badge> : null}
                    {hasIncoming ? (
                      <Badge variant="outline">Peringatan: {formatQty(r.incomingQuantity)} {r.unit} masih dalam PO, risiko overbuy</Badge>
                    ) : null}
                    {r.stockoutRisk ? <Badge variant="destructive">Risiko stockout (~{formatQty(r.daysOfCover)} hari)</Badge> : null}
                  </span>
                </span>
              </label>
              {s ? (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Jumlah ({r.unit})
                    <Input
                      className="w-28"
                      inputMode="decimal"
                      required
                      value={s.quantity}
                      onChange={(e) => update(r.id, { quantity: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Maks. tiba (hari)
                    <Input
                      className="w-24"
                      inputMode="numeric"
                      required={r.plannedLeadTimeDays === null}
                      value={s.maxDeliveryDays}
                      onChange={(e) => update(r.id, { maxDeliveryDays: e.target.value })}
                    />
                  </label>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {selectedRows.some((r) => r.inActiveRequest) ? (
        <p className="text-sm text-muted-foreground">
          Ada barang pilihan yang sedang diproses. Hanya satu proses sourcing boleh aktif; permintaan akan ditolak sampai
          proses itu selesai atau dibatalkan.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || selectedRows.length === 0}>
          {pending ? "Mengirim..." : `Minta penawaran (${selectedRows.length})`}
        </Button>
        {blockedBySourcing ? (
          <Link href="/procurement" className="text-sm underline">
            Lihat proses aktif
          </Link>
        ) : null}
      </div>
      <FormMessage error={error} />
    </form>
  );
}
