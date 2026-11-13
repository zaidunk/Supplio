"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";

export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!window.confirm(`Hapus produk "${name}"? Riwayat stoknya ikut terhapus dan tidak bisa dikembalikan.`)) return;
    setError(null);
    try {
      await apiRequest(`/api/products/${id}`, "DELETE");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={pending} aria-label={`Hapus produk ${name}`}>
        Hapus
      </Button>
      {error ? (
        <p role="alert" className="max-w-56 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
