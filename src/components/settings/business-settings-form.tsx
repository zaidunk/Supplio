"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field, FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import type { EvaluateOutcome } from "@/lib/procurement/trigger";
import { describeTrigger } from "@/lib/ui/status";

export function BusinessSettingsForm(props: { defaultRestockBudget: number; responseTimeoutMinutes: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const f = new FormData(e.currentTarget);
    try {
      const result = await apiRequest<{ trigger: EvaluateOutcome }>("/api/settings", "PUT", {
        defaultRestockBudget: Number(f.get("defaultRestockBudget")),
        responseTimeoutMinutes: Number(f.get("responseTimeoutMinutes")),
      });
      setInfo(describeTrigger(result.trigger) ?? "Tersimpan. Budget baru berlaku untuk request berikutnya.");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4">
      <Field
        label="Restock Budget default (Rp)"
        hint="Batas total satu procurement request (semua barang + ongkir). Disalin sebagai snapshot saat request dibuat. 0 = belum diatur."
      >
        <Input name="defaultRestockBudget" type="number" min={0} defaultValue={props.defaultRestockBudget} required />
      </Field>
      <Field label="Batas tunggu balasan supplier (menit)">
        <Input name="responseTimeoutMinutes" type="number" min={1} max={1440} defaultValue={props.responseTimeoutMinutes} required />
      </Field>
      <FormMessage error={error} info={info} />
      <div>
        <Button type="submit" disabled={pending}>
          Simpan
        </Button>
      </div>
    </form>
  );
}
