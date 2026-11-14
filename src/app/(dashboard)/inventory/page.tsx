import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Term } from "@/components/term";
import { DeleteProductButton } from "@/components/inventory/delete-product-button";
import { MovementForm } from "@/components/inventory/movement-form";
import { ProductForm } from "@/components/inventory/product-form";
import { RequestQuotePanel } from "@/components/inventory/request-quote-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { formatQty } from "@/lib/format";
import { getInventoryOverview, type InventoryRow } from "@/lib/inventory/overview";
import type { PlanningField } from "@/lib/inventory/restock";

const MISSING_LABEL: Record<PlanningField, string> = {
  dailyConsumption: "Daily Consumption",
  plannedLeadTimeDays: "Planned Lead Time",
  targetCoverageDays: "Target Coverage",
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
      {row.stockoutRisk ? <Badge variant="destructive">Risiko stockout (stok cukup ~{formatQty(row.daysOfCover)} hari)</Badge> : null}
    </div>
  );
}

export default async function InventoryPage() {
  const business = await requireBusiness();
  const rows = await getInventoryOverview(prisma, business.id);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Inventory"
      />

      <Card>
        <CardHeader>
          <CardTitle>Produk</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">
                  <Term hint="Stok fisik yang tersedia sekarang">Current Stock</Term>
                </TableHead>
                <TableHead className="text-right">
                  <Term hint="Jumlah dari purchase order yang sudah disetujui tetapi belum diterima">Incoming Quantity</Term>
                </TableHead>
                <TableHead className="text-right">
                  <Term hint="Current Stock ditambah Incoming Quantity">Inventory Position</Term>
                </TableHead>
                <TableHead className="text-right">
                  <Term hint="Batas stok: bila Inventory Position mencapai angka ini, restock dimulai">Reorder Point</Term>
                </TableHead>
                <TableHead className="text-right">
                  <Term hint="Sasaran posisi stok setelah pembelian">Target Stock</Term>
                </TableHead>
                <TableHead className="text-right">
                  <Term hint="Jumlah yang perlu dibeli agar mencapai Target Stock">Required Quantity</Term>
                </TableHead>
                <TableHead className="text-right">Stok cukup (hari)</TableHead>
                <TableHead className="text-right">Supplier aktif</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="whitespace-normal">
                    <EmptyState
                      title="Belum ada produk"
                      action={{ href: "#tambah-produk", label: "Tambah produk" }}
                    />
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
                  <TableCell className="text-right">{r.daysOfCover === null ? "-" : formatQty(r.daysOfCover)}</TableCell>
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
          <CardTitle>Catat mutasi stok</CardTitle>
        </CardHeader>
        <CardContent>
          <MovementForm products={rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit }))} />
        </CardContent>
      </Card>

      <Card id="minta-penawaran" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Minta penawaran manual</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestQuotePanel rows={rows} />
        </CardContent>
      </Card>

      <Card id="tambah-produk" className="scroll-mt-24">
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
