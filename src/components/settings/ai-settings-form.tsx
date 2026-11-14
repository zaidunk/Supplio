"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field, FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";

export function AiSettingsForm(props: {
  version: number;
  communicationTone: string;
  negotiationStyle: string;
  customInstructions: string;
}) {
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
      const saved = await apiRequest<{ version: number }>("/api/settings/ai", "PUT", {
        communicationTone: String(f.get("communicationTone")),
        negotiationStyle: String(f.get("negotiationStyle")),
        customInstructions: String(f.get("customInstructions") ?? ""),
      });
      setInfo(`Tersimpan sebagai versi ${saved.version}.`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4">
      <Field label="Nada komunikasi">
        <Input name="communicationTone" defaultValue={props.communicationTone} maxLength={200} required />
      </Field>
      <Field label="Gaya negosiasi">
        <Input name="negotiationStyle" defaultValue={props.negotiationStyle} maxLength={200} required />
      </Field>
      <Field label="Instruksi tambahan">
        <textarea
          name="customInstructions"
          defaultValue={props.customInstructions}
          maxLength={1000}
          rows={5}
          className="w-full rounded-xl border border-input bg-surface-raised px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
        />
      </Field>
      <FormMessage error={error} info={info} />
      <div>
        <Button type="submit" disabled={pending}>
          Simpan sebagai versi baru
        </Button>
      </div>
    </form>
  );
}
