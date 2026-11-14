import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ReceiptButton } from "@/components/procurement/receipt-form";
import { StatCard } from "@/components/stat-card";
import { PoStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatQty, formatRupiah } from "@/lib/format";
import { listPurchaseOrders } from "@/lib/procurement/receiving";

export default async function ReceivingPage() {
  const business = await requireBusiness();
  const all = await listPurchaseOrders(prisma, business.id);
  const outstanding = all.filter((p) => p.status === "CREATED" || p.status === "SENT" || p.status === "PARTIALLY_RECEIVED");
  const history = all.filter((p) => !outstanding.includes(p));
  const waiting = all.filter((p) => p.status === "CREATED" || p.status === "SENT").length;
  const partial = all.filter((p) => p.status === "PARTIALLY_RECEIVED").length;
  const received = all.filter((p) => p.status === "RECEIVED").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Penerimaan" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
        <StatCard label="Menunggu barang" value={waiting} />
        <StatCard label="Diterima sebagian" value={partial} />
        <StatCard label="Selesai diterima" value={received} />
      </div>

      {outstanding.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Tidak ada purchase order yang menunggu penerimaan"
              action={{ href: "/procurement", label: "Lihat procurement request" }}
            />
          </CardContent>
        </Card>
      ) : null}

      {outstanding.map((po) => (
        <Card key={po.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{po.poNumber}</CardTitle>
              <PoStatusBadge status={po.status} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Barang</TableHead>
                    <TableHead className="text-right">Dipesan</TableHead>
                    <TableHead className="text-right">Diterima</TableHead>
                    <TableHead className="text-right">Sisa</TableHead>
                    <TableHead className="text-right">Harga satuan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.items.map((i) => (
                    <TableRow key={i.productId}>
                      <TableCell className="font-medium">{i.productName}</TableCell>
                      <TableCell className="text-right">{formatQty(i.ordered)} {i.unit}</TableCell>
                      <TableCell className="text-right">{formatQty(i.received)} {i.unit}</TableCell>
                      <TableCell className="text-right">{formatQty(i.outstanding)} {i.unit}</TableCell>
                      <TableCell className="text-right">{formatRupiah(i.unitPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ReceiptButton purchaseOrderId={po.id} items={po.items.map((i) => ({ productId: i.productId, productName: i.productName, unit: i.unit, outstanding: i.outstanding }))} />
            {po.receipts.length > 0 ? (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Riwayat penerimaan ({po.receipts.length})</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {po.receipts.map((r) => (
                    <li key={r.id}>
                      {formatDateTime(r.receivedAt)}: {r.items.map((i) => `${i.productName} ${formatQty(i.receivedQuantity)}`).join(", ")}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat purchase order</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor PO</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Dibuat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.poNumber}</TableCell>
                    <TableCell>{po.supplierName}</TableCell>
                    <TableCell>
                      <PoStatusBadge status={po.status} />
                    </TableCell>
                    <TableCell className="text-right">{formatRupiah(po.totalCost)}</TableCell>
                    <TableCell>{formatDateTime(po.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
