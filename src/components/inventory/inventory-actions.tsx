"use client";

import { Plus } from "lucide-react";
import { MovementForm } from "@/components/inventory/movement-form";
import { ProductForm } from "@/components/inventory/product-form";
import { RequestQuotePanel } from "@/components/inventory/request-quote-panel";
import { Button } from "@/components/ui/button";
import { Dialog, useDialog } from "@/components/ui/dialog";
import type { InventoryRow } from "@/lib/inventory/overview";
import { iconProps } from "@/lib/ui/icons";

export type InventoryDialogName = "catat-mutasi" | "minta-penawaran" | "tambah-produk";

/** Tiga tombol kepala halaman Inventory beserta dialognya. `initial` membuka dialog dari tautan (?dialog=...). */
export function InventoryActions({ rows, initial }: { rows: InventoryRow[]; initial?: InventoryDialogName }) {
  const movement = useDialog(initial === "catat-mutasi");
  const quote = useDialog(initial === "minta-penawaran");
  const add = useDialog(initial === "tambah-produk");

  return (
    <>
      <Button type="button" variant="outline" onClick={movement.open}>
        Catat mutasi stok
      </Button>
      <Button type="button" variant="outline" onClick={quote.open}>
        Minta penawaran manual
      </Button>
      <Button type="button" onClick={add.open}>
        <Plus {...iconProps} />
        Tambah produk
      </Button>

      <Dialog dialog={movement} title="Catat mutasi stok" wide>
        <MovementForm products={rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit }))} />
      </Dialog>
      <Dialog dialog={quote} title="Minta penawaran manual" wide>
        <RequestQuotePanel rows={rows} />
      </Dialog>
      <Dialog dialog={add} title="Tambah produk" wide>
        <ProductForm />
      </Dialog>
    </>
  );
}
