import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { isSourcingActive } from "@/lib/procurement/lifecycle";
import { listRequests } from "@/lib/procurement/queries";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { RequestStatusBadge } from "@/components/status-badge";

export default async function ProcurementPage() {
  const business = await requireBusiness();
  const requests = await listRequests(prisma, business.id);
  const running = requests.filter((r) => isSourcingActive(r.status) && r.status !== "AWAITING_APPROVAL").length;
  const awaiting = requests.filter((r) => r.status === "AWAITING_APPROVAL").length;
  const completed = requests.filter((r) => r.status === "COMPLETED").length;
  const stopped = requests.filter((r) => ["NO_FEASIBLE_SOLUTION", "CANCELLED", "EXPIRED"].includes(r.status)).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Procurement" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <StatCard label="Sedang berjalan" value={running} />
        <StatCard label="Menunggu keputusan Anda" value={awaiting} />
        <StatCard label="Selesai" value={completed} />
        <StatCard label="Tidak berlanjut" value={stopped} />
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
                  <TableCell colSpan={6} className="whitespace-normal">
                    <EmptyState
                      title="Belum ada procurement request"
                      action={{ href: "/inventory?dialog=minta-penawaran", label: "Minta penawaran manual" }}
                    />
                  </TableCell>
                </TableRow>
              ) : null}
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/procurement/${r.id}`} className="font-medium hover:text-primary hover:underline underline-offset-4">
                      {formatDateTime(r.createdAt)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <RequestStatusBadge status={r.status} />
                      {r.triggerSource === "MANUAL" ? <Badge variant="outline">Manual</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{r.itemCount}</TableCell>
                  <TableCell className="text-right">{formatRupiah(r.restockBudget)}</TableCell>
                  <TableCell>{r.expiresAt ? formatDateTime(r.expiresAt) : "-"}</TableCell>
                  <TableCell>
                    <Link
                      href={`/procurement/${r.id}`}
                      aria-label={`Buka request ${formatDateTime(r.createdAt)}`}
                      className="text-sm font-medium text-primary underline underline-offset-4 hover:text-blue-800"
                    >
                      Buka
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
