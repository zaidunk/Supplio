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

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      {description ? <p className="-mt-1 text-xs text-muted-foreground">{description}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </fieldset>
  );
}

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
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Section title="Identitas produk">
        <Field label="Nama produk">
          <Input name="name" defaultValue={d?.name} required maxLength={120} />
        </Field>
        {editing ? (
          <Field label="Satuan">
            <Input value={`${d!.unit} (${d!.quantityScale} desimal)`} disabled readOnly />
          </Field>
        ) : (
          <>
            <Field label="Satuan dasar">
              <Input name="unit" required maxLength={20} />
            </Field>
            <Field label="Angka desimal">
              <Input name="quantityScale" type="number" min={0} max={3} defaultValue={0} />
            </Field>
            <Field label="Stok awal">
              <Input name="initialStock" inputMode="decimal" defaultValue="0" />
            </Field>
          </>
        )}
      </Section>

      <Section
        title="Perencanaan restock"
      >
        <Field label="Daily Consumption (per hari)">
          <Input name="dailyConsumption" inputMode="decimal" defaultValue={d?.dailyConsumption ?? ""} />
        </Field>
        <Field label="Planned Lead Time (hari)">
          <Input name="plannedLeadTimeDays" type="number" min={0} max={365} defaultValue={d?.plannedLeadTimeDays ?? ""} />
        </Field>
        <Field label="Target Coverage (hari)">
          <Input name="targetCoverageDays" type="number" min={0} max={365} defaultValue={d?.targetCoverageDays ?? ""} />
        </Field>
        <Field label="Safety Stock">
          <Input name="safetyStock" inputMode="decimal" defaultValue={d?.safetyStock ?? "0"} />
        </Field>
        <Field label="Manual Threshold">
          <Input name="manualThreshold" inputMode="decimal" defaultValue={d?.manualThreshold ?? "0"} />
        </Field>
      </Section>

      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-medium">Batas harga dan opsi lanjutan (opsional)</summary>
        <div className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Maximum Unit Price (Rp)">
            <Input name="maximumUnitPrice" type="number" min={1} defaultValue={d?.maximumUnitPrice ?? ""} />
          </Field>
          <Field label="Kelebihan beli diizinkan">
            <Input name="allowedOverbuyQuantity" inputMode="decimal" defaultValue={d?.allowedOverbuyQuantity ?? "0"} />
          </Field>
          <Field label="Harga beli terakhir (Rp)">
            <Input name="lastPurchaseUnitPrice" type="number" min={1} defaultValue={d?.lastPurchaseUnitPrice ?? ""} />
          </Field>
        </div>
      </details>

      <div className="flex flex-col gap-2">
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
