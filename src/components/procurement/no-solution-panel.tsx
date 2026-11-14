import { ButtonLink } from "@/components/ui/button-link";
import type { ManualHint } from "@/lib/procurement/manual-options";

/**
 * Opsi tindakan manual untuk NO_FEASIBLE_SOLUTION (SUPPLIO.md §9). Tidak ada yang dijalankan otomatis dan tidak ada
 * constraint yang dilonggarkan pada request ini: pemilik membuat permintaan penawaran BARU dengan parameter yang ia pilih.
 */
export function NoSolutionPanel({ hints }: { hints: ManualHint[] }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-warning/40 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Yang bisa Anda lakukan</p>
        <p className="text-sm text-muted-foreground">
          Request ini sudah selesai tanpa pembelian. Batasnya tidak diubah otomatis. Buat permintaan penawaran baru setelah
          menyesuaikan hal berikut.
        </p>
      </div>
      <ul className="flex flex-col gap-3 text-sm">
        {hints.map((h) => (
          <li key={h.productName} className="flex flex-col gap-0.5">
            <span className="font-medium">{h.productName}</span>
            {h.messages.map((m, i) => (
              <span key={i} className="text-muted-foreground">
                {m}
              </span>
            ))}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Saat membuat permintaan baru, Anda bisa mengisi jumlah dan batas kedatangan per barang. Cek juga Restock Budget.
      </p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/inventory?dialog=minta-penawaran" size="lg">
          Minta penawaran baru
        </ButtonLink>
        <ButtonLink href="/suppliers" variant="outline" size="lg">
          Kelola supplier
        </ButtonLink>
      </div>
    </div>
  );
}
