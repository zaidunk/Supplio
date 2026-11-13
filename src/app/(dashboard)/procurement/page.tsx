import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { listRequests } from "@/lib/procurement/queries";
import { STATUS_LABEL } from "@/lib/ui/status";

export default async function ProcurementPage() {
  const business = await requireBusiness();
  const requests = await listRequests(prisma, business.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-medium tracking-[-0.03em] text-blue-700">Procurement</h1>
        <p className="mt-3 max-w-[68ch] text-base text-muted-foreground">
          Pantau permintaan penawaran, negosiasi supplier, dan rekomendasi pembelian. Request dibuat otomatis saat
          restock terdeteksi, atau manual dari halaman Inventory.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Procurement request</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dibuat</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Barang</TableHead>
                <TableHead className="text-right">Restock Budget</TableHead>
                <TableHead>Berlaku sampai</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Belum ada procurement request. Request pertama dibuat otomatis saat restock terdeteksi, atau minta
                    penawaran manual dari Inventory.
                  </TableCell>
                </TableRow>
              ) : null}
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="secondary">{STATUS_LABEL[r.status]}</Badge>
                      {r.triggerSource === "MANUAL" ? <Badge variant="outline">Manual</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{r.itemCount}</TableCell>
                  <TableCell className="text-right">{formatRupiah(r.restockBudget)}</TableCell>
                  <TableCell>{r.expiresAt ? formatDateTime(r.expiresAt) : "-"}</TableCell>
                  <TableCell>
                    <Link href={`/procurement/${r.id}`} className="text-sm font-medium text-primary underline underline-offset-4 hover:text-blue-800">
                      Lihat detail
                    </Link>
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
