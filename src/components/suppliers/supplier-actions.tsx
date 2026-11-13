"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    }
  }
  return { pending, error, run };
}

export function ToggleActiveButton({ supplierId, isActive }: { supplierId: string; isActive: boolean }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(() => apiRequest(`/api/suppliers/${supplierId}`, "PATCH", { isActive: !isActive }))}
      >
        {isActive ? "Nonaktifkan" : "Aktifkan"}
      </Button>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function RemoveProductButton({ supplierId, productId }: { supplierId: string; productId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(() => apiRequest(`/api/suppliers/${supplierId}`, "PATCH", { removeProductIds: [productId] }))}
      >
        Lepas
      </Button>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
