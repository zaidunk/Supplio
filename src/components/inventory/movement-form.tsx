"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Field, FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { apiRequest } from "@/lib/api-client";
import type { EvaluateOutcome } from "@/lib/procurement/trigger";
import { describeTrigger } from "@/lib/ui/status";

type ProductOption = { id: string; name: string; unit: string };

export function MovementForm({ products }: { products: ProductOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [type, setType] = useState<"IN" | "OUT" | "ADJUSTMENT">("OUT");
  // Satu kunci per percobaan kirim: klik ganda/retry jaringan tidak menggandakan mutasi.
  const attemptKey = useRef<string>(crypto.randomUUID());

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      const result = await apiRequest<{ duplicate: boolean; currentStock: string; trigger: EvaluateOutcome }>(
        "/api/inventory/movements",
        "POST",
        {
          productId: String(f.get("productId")),
          type,
          quantity: String(f.get("quantity")),
          note: String(f.get("note") ?? "") || undefined,
          idempotencyKey: attemptKey.current,
        },
      );
      attemptKey.current = crypto.randomUUID(); // berhasil → percobaan berikutnya memakai kunci baru
      setInfo(describeTrigger(result.trigger) ?? `Tercatat. Stok sekarang ${result.currentStock}.`);
      form.reset();
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencatat mutasi.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="Produk">
        <NativeSelect name="productId" required defaultValue="">
          <option value="" disabled>
            Pilih produk
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.unit})
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Jenis mutasi">
        <NativeSelect value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="OUT">Barang keluar</option>
          <option value="IN">Barang masuk</option>
          <option value="ADJUSTMENT">Penyesuaian stok (+/-)</option>
        </NativeSelect>
      </Field>
      <Field label="Jumlah" hint={type === "ADJUSTMENT" ? "Boleh negatif, mis. -2,5" : undefined}>
        <Input name="quantity" inputMode="decimal" required />
      </Field>
      <Field label="Catatan (opsional)">
        <Input name="note" maxLength={300} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={pending || products.length === 0}>
          Catat mutasi
        </Button>
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
        <FormMessage error={error} info={info} />
      </div>
    </form>
  );
}
