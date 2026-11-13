import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { formatRupiah } from "@/lib/format";
import { getInventoryOverview } from "@/lib/inventory/overview";
import { isSourcingActive } from "@/lib/procurement/lifecycle";
import { listRequests } from "@/lib/procurement/queries";
import { STATUS_LABEL } from "@/lib/ui/status";

function Stat({ label, value, href }: { label: string; value: string | number; href: string }) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-3xl">{value}</CardTitle>
        </CardHeader>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const business = await requireBusiness();
  const [rows, requests, settings] = await Promise.all([
    getInventoryOverview(prisma, business.id),
    listRequests(prisma, business.id),
    prisma.business.findUniqueOrThrow({ where: { id: business.id }, select: { defaultRestockBudget: true } }),
  ]);

  const needRestock = rows.filter((r) => r.triggerRestock && !r.inActiveRequest);
  const incomplete = rows.filter((r) => r.configurationMissing.length > 0);
  const atRisk = rows.filter((r) => r.stockoutRisk);
  const active = requests.filter((r) => isSourcingActive(r.status));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {settings.defaultRestockBudget <= 0 ? (
        <Card className="border-destructive/50">
          <CardContent className="py-4 text-sm">
            <strong>Restock Budget belum diatur.</strong> Restock yang terdeteksi tidak bisa diproses sebelum budget
            diisi. <Link href="/settings" className="underline">Atur di Pengaturan</Link>.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Barang perlu restock" value={needRestock.length} href="/inventory" />
        <Stat label="Proses sourcing aktif" value={active.length} href="/procurement" />
        <Stat label="Barang berisiko stockout" value={atRisk.length} href="/inventory" />
        <Stat label="Restock Budget default" value={formatRupiah(settings.defaultRestockBudget)} href="/settings" />
      </div>

      {incomplete.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Konfigurasi belum lengkap</CardTitle>
            <CardDescription>Barang berikut tidak bisa dievaluasi untuk restock.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {incomplete.map((r) => (
              <Badge key={r.id} variant="destructive">
                {r.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Request terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada procurement request.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {requests.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  <Badge variant="secondary">{STATUS_LABEL[r.status]}</Badge>
                  <span>{r.itemCount} barang</span>
                  <Link href={`/procurement/${r.id}`} className="underline">
                    Detail
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
