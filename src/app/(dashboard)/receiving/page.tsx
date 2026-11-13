import Link from "next/link";
import { ReceiptForm } from "@/components/procurement/receipt-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatQty, formatRupiah } from "@/lib/format";
import { listPurchaseOrders } from "@/lib/procurement/receiving";
import { PO_STATUS_LABEL } from "@/lib/ui/status";

export default async function ReceivingPage() {
  const business = await requireBusiness();
  const all = await listPurchaseOrders(prisma, business.id);
  const outstanding = all.filter((p) => p.status === "CREATED" || p.status === "SENT" || p.status === "PARTIALLY_RECEIVED");
  const history = all.filter((p) => !outstanding.includes(p));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.03em] text-blue-700">Penerimaan barang</h1>
        <p className="mt-3 max-w-[68ch] text-base text-muted-foreground">
          Catat barang yang benar-benar diterima. Stok bertambah hanya sebesar jumlah yang Anda isi, dan tidak boleh melebihi sisa pesanan.
        </p>
      </div>

      {outstanding.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Tidak ada PO yang menunggu penerimaan.</CardContent>
        </Card>
      ) : null}

      {outstanding.map((po) => (
        <Card key={po.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{po.poNumber}</CardTitle>
              <Badge variant="secondary">{PO_STATUS_LABEL[po.status]}</Badge>
            </div>
            <CardDescription>
              {po.supplierName} · total {formatRupiah(po.totalCost)} ·{" "}
              <Link href={`/procurement/${po.requestId}`} className="font-medium text-primary underline underline-offset-4 hover:text-blue-800">
                lihat request
              </Link>
            </CardDescription>
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
                      <TableCell className="text-right">{formatQty(i.received)}</TableCell>
                      <TableCell className="text-right">{formatQty(i.outstanding)}</TableCell>
                      <TableCell className="text-right">{formatRupiah(i.unitPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ReceiptForm purchaseOrderId={po.id} items={po.items.map((i) => ({ productId: i.productId, productName: i.productName, unit: i.unit, outstanding: i.outstanding }))} />
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
            <CardTitle>Riwayat PO</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead>
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
                    <TableCell>{PO_STATUS_LABEL[po.status]}</TableCell>
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
