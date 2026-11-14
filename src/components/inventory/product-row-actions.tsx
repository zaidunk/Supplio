"use client";

import { Pencil } from "lucide-react";
import { DeleteProductButton } from "@/components/inventory/delete-product-button";
import { ProductForm } from "@/components/inventory/product-form";
import { Button } from "@/components/ui/button";
import { Dialog, useDialog } from "@/components/ui/dialog";
import type { InventoryRow } from "@/lib/inventory/overview";
import { iconProps } from "@/lib/ui/icons";

/** Ubah konfigurasi (dialog) dan Hapus di kolom paling kanan tabel produk. */
export function ProductRowActions({ product }: { product: InventoryRow }) {
  const edit = useDialog();
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={edit.open} aria-label={`Ubah konfigurasi ${product.name}`}>
        <Pencil {...iconProps} />
        Ubah
      </Button>
      <Dialog dialog={edit} title={`Ubah konfigurasi ${product.name}`} wide>
        <ProductForm product={product} />
      </Dialog>
      <DeleteProductButton id={product.id} name={product.name} />
    </div>
  );
}
