import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Term } from "@/components/term";
import { InventoryActions, type InventoryDialogName } from "@/components/inventory/inventory-actions";
import { ProductRowActions } from "@/components/inventory/product-row-actions";
import { ProductStatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
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
        <ProductStatusBadge kind="incomplete">Lengkapi: {row.configurationMissing.map((m) => MISSING_LABEL[m]).join(", ")}</ProductStatusBadge>
      ) : row.inActiveRequest ? (
        <ProductStatusBadge kind="processing">Sedang diproses</ProductStatusBadge>
      ) : row.triggerRestock ? (
        <ProductStatusBadge kind="restock">Perlu restock</ProductStatusBadge>
      ) : (
        <ProductStatusBadge kind="safe">Aman</ProductStatusBadge>
      )}
      {row.triggerRestock && row.activeSupplierCount === 0 ? (
        <ProductStatusBadge kind="stockout">Belum ada supplier aktif</ProductStatusBadge>
      ) : null}
      {row.stockoutRisk ? (
        <ProductStatusBadge kind="stockout">Risiko stockout (stok cukup ~{formatQty(row.daysOfCover)} hari)</ProductStatusBadge>
      ) : null}
    </div>
  );
}

const DIALOGS: InventoryDialogName[] = ["catat-mutasi", "minta-penawaran", "tambah-produk"];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ dialog?: string }> }) {
  const business = await requireBusiness();
  const [rows, { dialog }] = await Promise.all([getInventoryOverview(prisma, business.id), searchParams]);
  const initial = DIALOGS.find((d) => d === dialog);

  // Angka kartu dihitung dari baris yang sama dengan tabel (definisi "perlu restock" sama dengan Dashboard).
  const needRestock = rows.filter((r) => r.triggerRestock && !r.inActiveRequest).length;
  const processing = rows.filter((r) => r.inActiveRequest).length;
  const incomplete = rows.filter((r) => r.configurationMissing.length > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inventory" actions={<InventoryActions key={initial ?? ""} rows={rows} initial={initial} />} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <StatCard label="Total produk" value={rows.length} />
        <StatCard label="Perlu restock" value={needRestock} />
        <StatCard label="Sedang diproses" value={processing} />
        <StatCard label="Konfigurasi belum lengkap" value={incomplete} />
      </div>

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
                      action={{ href: "/inventory?dialog=tambah-produk", label: "Tambah produk" }}
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
                    <ProductRowActions product={r} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
