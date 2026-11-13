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
      setInfo(`Tersimpan sebagai versi ${saved.version}. Berlaku untuk request dan sesi negosiasi baru.`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4">
      <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        Pengaturan ini hanya mengubah <strong>gaya</strong> komunikasi AI. Restock Budget, Maximum Unit Price, Final
        Approval, dan jumlah putaran negosiasi tetap ditegakkan sistem. Versi aktif: {props.version}.
      </p>
      <Field label="Nada komunikasi" hint="Contoh: sopan dan santai">
        <Input name="communicationTone" defaultValue={props.communicationTone} maxLength={200} required />
      </Field>
      <Field label="Gaya negosiasi" hint="Contoh: tegas tetapi ramah">
        <Input name="negotiationStyle" defaultValue={props.negotiationStyle} maxLength={200} required />
      </Field>
      <Field label="Instruksi tambahan" hint="Opsional, maksimal 1000 karakter">
        <textarea
          name="customInstructions"
          defaultValue={props.customInstructions}
          maxLength={1000}
          rows={5}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
