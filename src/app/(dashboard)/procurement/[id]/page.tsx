import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { formatDateTime, formatQty, formatRupiah } from "@/lib/format";
import { getRequestDetail } from "@/lib/procurement/queries";
import { idSchema } from "@/lib/validation/common";
import { STATUS_LABEL } from "@/lib/ui/status";

export default async function ProcurementDetailPage(props: PageProps<"/procurement/[id]">) {
  const business = await requireBusiness();
  const parsed = idSchema.safeParse((await props.params).id);
  if (!parsed.success) notFound();

  let request;
  try {
    request = await getRequestDetail(prisma, business.id, parsed.data);
  } catch (e) {
    if (e instanceof DomainError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/procurement" className="text-sm text-muted-foreground underline">
          ← Semua request
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Procurement request</h1>
          <Badge variant="secondary">{STATUS_LABEL[request.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Dibuat {formatDateTime(request.createdAt)} · Restock Budget {formatRupiah(request.restockBudget)} (snapshot) ·
          Pengaturan AI v{request.aiSettingsVersion}
          {request.expiresAt ? ` · Kedaluwarsa ${formatDateTime(request.expiresAt)}` : ""}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kebutuhan</CardTitle>
          <CardDescription>Snapshot saat request dibuat (untuk audit).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">Dibutuhkan</TableHead>
                <TableHead className="text-right">Batas kedatangan</TableHead>
                <TableHead className="text-right">Kelebihan beli diizinkan</TableHead>
                <TableHead>Peringatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {request.items.map((i) => (
                <TableRow key={i.productId}>
                  <TableCell className="font-medium">{i.productName}</TableCell>
                  <TableCell className="text-right">
                    {formatQty(i.requiredQuantity)} {i.unit}
                  </TableCell>
                  <TableCell className="text-right">{i.maxDeliveryDays} hari</TableCell>
                  <TableCell className="text-right">{formatQty(i.allowedOverbuyQuantity)}</TableCell>
                  <TableCell>
                    {i.stockoutRisk ? (
                      <Badge variant="destructive">Risiko stockout (stok ~{formatQty(i.daysOfCover)} hari)</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat status</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-2 text-sm">
            {request.transitions.map((t, idx) => (
              <li key={idx} className="flex flex-wrap gap-2">
                <span className="text-muted-foreground">{formatDateTime(t.createdAt)}</span>
                <span>
                  {t.fromStatus ? `${STATUS_LABEL[t.fromStatus]} → ` : ""}
                  {STATUS_LABEL[t.toStatus]}
                </span>
                {t.reason ? <span className="text-muted-foreground">({t.reason})</span> : null}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
