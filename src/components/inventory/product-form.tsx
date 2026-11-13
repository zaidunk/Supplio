"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field, FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, blankToNull, toIntOrNull } from "@/lib/api-client";
import type { InventoryRow } from "@/lib/inventory/overview";
import type { EvaluateOutcome } from "@/lib/procurement/trigger";
import { describeTrigger } from "@/lib/ui/status";

type Props = { product?: InventoryRow };

/** Satu form untuk tambah (tanpa `product`) dan ubah konfigurasi (dengan `product`). Stok hanya lewat mutasi. */
export function ProductForm({ product }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const editing = Boolean(product);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "");

    const planning = {
      lastPurchaseUnitPrice: toIntOrNull(str("lastPurchaseUnitPrice")),
      dailyConsumption: blankToNull(str("dailyConsumption")),
      manualThreshold: str("manualThreshold") || "0",
      plannedLeadTimeDays: toIntOrNull(str("plannedLeadTimeDays")),
      safetyStock: str("safetyStock") || "0",
      targetCoverageDays: toIntOrNull(str("targetCoverageDays")),
      maximumUnitPrice: toIntOrNull(str("maximumUnitPrice")),
      allowedOverbuyQuantity: str("allowedOverbuyQuantity") || "0",
    };

    try {
      const result = editing
        ? await apiRequest<{ trigger: EvaluateOutcome }>(`/api/products/${product!.id}`, "PATCH", {
            name: str("name"),
            ...planning,
          })
        : await apiRequest<{ trigger: EvaluateOutcome }>("/api/products", "POST", {
            name: str("name"),
            unit: str("unit"),
            quantityScale: Number(str("quantityScale") || 0),
            initialStock: str("initialStock") || "0",
            ...planning,
          });
      setInfo(describeTrigger(result.trigger) ?? "Tersimpan.");
      if (!editing) e.currentTarget.reset();
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    }
  }

  const d = product;
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Nama produk">
        <Input name="name" defaultValue={d?.name} required maxLength={120} />
      </Field>
      {editing ? (
        <Field label="Satuan" hint="Tidak bisa diubah setelah produk dibuat">
          <Input value={`${d!.unit} (${d!.quantityScale} desimal)`} disabled readOnly />
        </Field>
      ) : (
        <>
          <Field label="Satuan dasar" hint="mis. kg, liter, pcs">
            <Input name="unit" required maxLength={20} />
          </Field>
          <Field label="Angka desimal" hint="0 untuk bilangan bulat, maksimal 3">
            <Input name="quantityScale" type="number" min={0} max={3} defaultValue={0} />
          </Field>
          <Field label="Stok awal">
            <Input name="initialStock" inputMode="decimal" defaultValue="0" />
          </Field>
        </>
      )}
      <Field label="Daily Consumption (per hari)" hint="Wajib. Rata-rata pemakaian per hari, dalam satuan produk">
        <Input name="dailyConsumption" inputMode="decimal" defaultValue={d?.dailyConsumption ?? ""} />
      </Field>
      <Field label="Manual Threshold" hint="Batas stok minimum versi Anda. Isi 0 jika tidak dipakai">
        <Input name="manualThreshold" inputMode="decimal" defaultValue={d?.manualThreshold ?? "0"} />
      </Field>
      <Field label="Planned Lead Time (hari)" hint="Wajib. Perkiraan waktu dari pesan sampai barang tiba">
        <Input name="plannedLeadTimeDays" type="number" min={0} max={365} defaultValue={d?.plannedLeadTimeDays ?? ""} />
      </Field>
      <Field label="Safety Stock" hint="Cadangan stok yang Anda tetapkan. Default 0">
        <Input name="safetyStock" inputMode="decimal" defaultValue={d?.safetyStock ?? "0"} />
      </Field>
      <Field label="Target Coverage (hari)" hint="Wajib. Hari pemakaian yang ingin dicakup setelah lead time">
        <Input name="targetCoverageDays" type="number" min={0} max={365} defaultValue={d?.targetCoverageDays ?? ""} />
      </Field>
      <Field label="Maximum Unit Price (Rp)" hint="Opsional. Penawaran di atas harga ini tidak dipakai">
        <Input name="maximumUnitPrice" type="number" min={1} defaultValue={d?.maximumUnitPrice ?? ""} />
      </Field>
      <Field label="Kelebihan beli diizinkan" hint="Jumlah di atas kebutuhan yang masih boleh dibeli. Default 0">
        <Input name="allowedOverbuyQuantity" inputMode="decimal" defaultValue={d?.allowedOverbuyQuantity ?? "0"} />
      </Field>
      <Field label="Harga beli terakhir (Rp)" hint="Opsional, hanya sebagai referensi">
        <Input name="lastPurchaseUnitPrice" type="number" min={1} defaultValue={d?.lastPurchaseUnitPrice ?? ""} />
      </Field>
      <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-4">
        <FormMessage error={error} info={info} />
        <div>
          <Button type="submit" disabled={pending}>
            {editing ? "Simpan perubahan" : "Tambah produk"}
          </Button>
        </div>
      </div>
    </form>
  );
}
