"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, useDialog } from "@/components/ui/dialog";
import { FormMessage } from "@/components/form-field";
import { apiRequest } from "@/lib/api-client";
import { iconProps } from "@/lib/ui/icons";
import { Trash2 } from "lucide-react";

export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const dialog = useDialog();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setError(null);
    try {
      await apiRequest(`/api/products/${id}`, "DELETE");
      dialog.close();
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null);
          dialog.open();
        }}
        disabled={pending}
        aria-label={`Hapus produk ${name}`}
      >
        <Trash2 {...iconProps} />
        Hapus
      </Button>
      <Dialog
        dialog={dialog}
        title={`Hapus produk "${name}"?`}
        description="Riwayat stoknya ikut terhapus dan tidak bisa dikembalikan."
      >
        <FormMessage error={error} />
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={dialog.close}>
            Batal
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
            Hapus produk
          </Button>
        </div>
      </Dialog>
    </>
  );
}
