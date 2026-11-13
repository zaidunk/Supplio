import { DeleteProductButton } from "@/components/inventory/delete-product-button";
import { MovementForm } from "@/components/inventory/movement-form";
import { ProductForm } from "@/components/inventory/product-form";
import { RequestQuotePanel } from "@/components/inventory/request-quote-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { formatQty } from "@/lib/format";
import { getInventoryOverview, type InventoryRow } from "@/lib/inventory/overview";
import type { PlanningField } from "@/lib/inventory/restock";

const MISSING_LABEL: Record<PlanningField, string> = {
  dailyConsumption: "konsumsi harian",
  plannedLeadTimeDays: "lead time",
  targetCoverageDays: "target cakupan",
};

function StatusBadges({ row }: { row: InventoryRow }) {
  return (
    <div className="flex flex-col items-start gap-1">
      {row.configurationMissing.length > 0 ? (
        <Badge variant="destructive">Lengkapi: {row.configurationMissing.map((m) => MISSING_LABEL[m]).join(", ")}</Badge>
      ) : row.inActiveRequest ? (
        <Badge variant="secondary">Sedang diproses</Badge>
      ) : row.triggerRestock ? (
        <Badge>Perlu restock</Badge>
      ) : (
        <Badge variant="outline">Aman</Badge>
      )}
      {row.triggerRestock && row.activeSupplierCount === 0 ? (
        <Badge variant="destructive">Belum ada supplier aktif</Badge>
      ) : null}
      {row.stockoutRisk ? <Badge variant="destructive">Risiko stockout (~{formatQty(row.daysOfCover)} hari)</Badge> : null}
    </div>
  );
}

export default async function InventoryPage() {
  const business = await requireBusiness();
  const rows = await getInventoryOverview(prisma, business.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.03em] text-blue-700">Inventory</h1>
        <p className="mt-3 max-w-[68ch] text-base text-muted-foreground">
          Restock dipicu otomatis ketika posisi stok (stok + barang dalam PO) mencapai reorder point.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catat mutasi stok</CardTitle>
          <CardDescription>Setiap mutasi memicu evaluasi restock. Penerimaan barang dari PO dicatat di fase berikutnya.</CardDescription>
        </CardHeader>
        <CardContent>
          <MovementForm products={rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Minta penawaran manual</CardTitle>
          <CardDescription>
            Pilih barang yang ingin Anda tanyakan harganya ke supplier sekarang, tanpa menunggu reorder point. Jumlah bisa
            diubah. Barang yang masih dalam PO tetap bisa dipilih, tetapi waspadai overbuy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RequestQuotePanel rows={rows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produk</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead className="text-right">Dalam PO</TableHead>
                <TableHead className="text-right">Posisi</TableHead>
                <TableHead className="text-right">Reorder point</TableHead>
                <TableHead className="text-right">Target stok</TableHead>
                <TableHead className="text-right">Dibutuhkan</TableHead>
                <TableHead className="text-right">Supplier aktif</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Belum ada produk.
                  </TableCell>
                </TableRow>
              ) : null}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.name} <span className="text-muted-foreground">({r.unit})</span>
                  </TableCell>
                  <TableCell className="text-right">{formatQty(r.currentStock)}</TableCell>
                  <TableCell className="text-right">{formatQty(r.incomingQuantity)}</TableCell>
                  <TableCell className="text-right">{formatQty(r.inventoryPosition)}</TableCell>
                  <TableCell className="text-right">{formatQty(r.reorderPoint)}</TableCell>
                  <TableCell className="text-right">{formatQty(r.targetStock)}</TableCell>
                  <TableCell className="text-right">{formatQty(r.requiredQuantity)}</TableCell>
                  <TableCell className="text-right">{r.activeSupplierCount}</TableCell>
                  <TableCell>
                    <StatusBadges row={r} />
                  </TableCell>
                  <TableCell>
                    <DeleteProductButton id={r.id} name={r.name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tambah produk</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm />
        </CardContent>
      </Card>

      {rows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ubah konfigurasi produk</CardTitle>
            <CardDescription>Perubahan konfigurasi juga memicu evaluasi restock. Stok hanya berubah lewat mutasi.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {rows.map((r) => (
              <details key={r.id} className="rounded-md border p-3">
                <summary className="cursor-pointer text-sm font-medium">{r.name}</summary>
                <div className="pt-4">
                  <ProductForm product={r} />
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
