"use client";

import { Plus } from "lucide-react";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { Button } from "@/components/ui/button";
import { Dialog, useDialog } from "@/components/ui/dialog";
import { iconProps } from "@/lib/ui/icons";

type ProductOption = { id: string; name: string; unit: string };

/** Tombol "Tambah supplier" di kepala halaman; `initialOpen` membuka dialog dari tautan (?dialog=tambah-supplier). */
export function AddSupplierButton({ products, initialOpen = false }: { products: ProductOption[]; initialOpen?: boolean }) {
  const dialog = useDialog(initialOpen);
  return (
    <>
      <Button type="button" onClick={dialog.open}>
        <Plus {...iconProps} />
        Tambah supplier
      </Button>
      <Dialog dialog={dialog} title="Tambah supplier" wide>
        <SupplierForm products={products} />
      </Dialog>
    </>
  );
}

export function SupplierProductsButton({ products, supplierId, supplierName }: { products: ProductOption[]; supplierId: string; supplierName: string }) {
  const dialog = useDialog();
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={dialog.open}>
        Tambah atau ubah produk supplier
      </Button>
      <Dialog dialog={dialog} title={`Produk supplier ${supplierName}`} wide>
        <SupplierForm products={products} supplierId={supplierId} />
      </Dialog>
    </>
  );
}
