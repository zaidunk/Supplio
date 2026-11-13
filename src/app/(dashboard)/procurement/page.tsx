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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Procurement</h1>
        <p className="text-sm text-muted-foreground">
          Request dibuat otomatis saat restock terdeteksi. Negosiasi Telegram dan rekomendasi menyusul di fase berikutnya.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Daftar request</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dibuat</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Barang</TableHead>
                <TableHead className="text-right">Restock Budget</TableHead>
                <TableHead>Kedaluwarsa</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Belum ada procurement request.
                  </TableCell>
                </TableRow>
              ) : null}
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{STATUS_LABEL[r.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{r.itemCount}</TableCell>
                  <TableCell className="text-right">{formatRupiah(r.restockBudget)}</TableCell>
                  <TableCell>{r.expiresAt ? formatDateTime(r.expiresAt) : "-"}</TableCell>
                  <TableCell>
                    <Link href={`/procurement/${r.id}`} className="text-sm underline">
                      Detail
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
