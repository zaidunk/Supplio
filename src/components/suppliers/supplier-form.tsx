"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field, FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { apiRequest, blankToNull, toIntOrNull } from "@/lib/api-client";

type ProductOption = { id: string; name: string; unit: string };

interface Row {
  key: number;
  productId: string;
  referenceUnitPrice: string;
  minimumOrderQuantity: string;
  packSize: string;
  referenceAvailableQuantity: string;
  referenceLeadTimeDays: string;
  referenceShippingFee: string;
  isPrimary: boolean;
}

const emptyRow = (key: number): Row => ({
  key,
  productId: "",
  referenceUnitPrice: "",
  minimumOrderQuantity: "1",
  packSize: "",
  referenceAvailableQuantity: "",
  referenceLeadTimeDays: "1",
  referenceShippingFee: "",
  isPrimary: false,
});

/**
 * Tanpa `supplierId`: buat supplier baru (nama + baris produk).
 * Dengan `supplierId`: tambah/ubah harga-MOQ-lead time referensi (upsert per produk) untuk supplier itu.
 * Harga referensi hanyalah petunjuk; harga yang dipakai optimizer tetap berasal dari penawaran aktual supplier.
 */
export function SupplierForm({ products, supplierId }: { products: ProductOption[]; supplierId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>(supplierId ? [emptyRow(0)] : []);
  const [nextKey, setNextKey] = useState(1);
  const creating = !supplierId;

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const productsPayload = rows
      .filter((r) => r.productId)
      .map((r) => ({
        productId: r.productId,
        referenceUnitPrice: Number(r.referenceUnitPrice),
        minimumOrderQuantity: r.minimumOrderQuantity || "1",
        packSize: blankToNull(r.packSize),
        referenceAvailableQuantity: blankToNull(r.referenceAvailableQuantity),
        referenceLeadTimeDays: Number(r.referenceLeadTimeDays),
        referenceShippingFee: toIntOrNull(r.referenceShippingFee),
        isPrimary: r.isPrimary,
      }));

    try {
      if (creating) await apiRequest("/api/suppliers", "POST", { name, products: productsPayload });
      else await apiRequest(`/api/suppliers/${supplierId}`, "PATCH", { products: productsPayload });
      setInfo("Tersimpan.");
      if (creating) {
        setName("");
        setRows([]);
      } else {
        setRows([emptyRow(nextKey)]);
        setNextKey((k) => k + 1);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {creating ? (
        <div className="max-w-sm">
          <Field label="Nama supplier">
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
          </Field>
        </div>
      ) : null}

      {rows.map((r) => (
        <div key={r.key} className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
          <Field label="Produk">
            <NativeSelect value={r.productId} onChange={(e) => update(r.key, { productId: e.target.value })} required>
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
          <Field label="Harga referensi per satuan dasar (Rp)">
            <Input type="number" min={1} value={r.referenceUnitPrice} onChange={(e) => update(r.key, { referenceUnitPrice: e.target.value })} required />
          </Field>
          <Field label="MOQ">
            <Input inputMode="decimal" value={r.minimumOrderQuantity} onChange={(e) => update(r.key, { minimumOrderQuantity: e.target.value })} />
          </Field>
          <Field label="Isi kemasan (kelipatan)">
            <Input inputMode="decimal" value={r.packSize} onChange={(e) => update(r.key, { packSize: e.target.value })} />
          </Field>
          <Field label="Stok referensi">
            <Input inputMode="decimal" value={r.referenceAvailableQuantity} onChange={(e) => update(r.key, { referenceAvailableQuantity: e.target.value })} />
          </Field>
          <Field label="Lead time (hari)">
            <Input type="number" min={0} max={365} value={r.referenceLeadTimeDays} onChange={(e) => update(r.key, { referenceLeadTimeDays: e.target.value })} required />
          </Field>
          <Field label="Ongkir referensi (Rp)">
            <Input type="number" min={0} value={r.referenceShippingFee} onChange={(e) => update(r.key, { referenceShippingFee: e.target.value })} />
          </Field>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={r.isPrimary} onChange={(e) => update(r.key, { isPrimary: e.target.checked })} />
              Supplier utama
            </label>
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
              Hapus produk ini
            </Button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={products.length === 0}
          onClick={() => {
            setRows((rs) => [...rs, emptyRow(nextKey)]);
            setNextKey((k) => k + 1);
          }}
        >
          Tambah produk yang disuplai
        </Button>
        <Button type="submit" disabled={pending || (!creating && rows.length === 0)}>
          {creating ? "Simpan supplier" : "Simpan referensi"}
        </Button>
      </div>
      <FormMessage error={error} info={info} />
    </form>
  );
}
