import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { listPurchaseOrders } from "@/lib/procurement/receiving";
import { getInventoryOverview } from "@/lib/inventory/overview";
import { isSourcingActive } from "@/lib/procurement/lifecycle";
import { listRequests } from "@/lib/procurement/queries";
import { STATUS_LABEL } from "@/lib/ui/status";

function Stat({
  label,
  value,
  href,
  featured = false,
}: {
  label: string;
  value: string | number;
  href: string;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className={featured ? "sm:col-span-2 lg:col-span-2" : undefined}
    >
      <Card
        className={
          featured
            ? "h-full border-transparent bg-[image:var(--grad-blue)] text-white shadow-md transition-transform hover:-translate-y-0.5"
            : "h-full transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm"
        }
      >
        <CardHeader className="gap-2">
          <CardTitle
            className={
              featured
                ? "text-[clamp(2.5rem,5vw,3.5rem)] leading-none font-extrabold tracking-[-0.03em] tabular-nums"
                : "text-2xl leading-none font-extrabold tracking-[-0.02em] tabular-nums xl:text-3xl"
            }
          >
            {value}
          </CardTitle>
          <CardDescription className={featured ? "text-base text-blue-100" : "text-sm"}>{label}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const business = await requireBusiness();
  const [rows, requests, openOrders, settings] = await Promise.all([
    getInventoryOverview(prisma, business.id),
    listRequests(prisma, business.id),
    listPurchaseOrders(prisma, business.id, { outstandingOnly: true }),
    prisma.business.findUniqueOrThrow({ where: { id: business.id }, select: { defaultRestockBudget: true } }),
  ]);

  const needRestock = rows.filter((r) => r.triggerRestock && !r.inActiveRequest);
  const incomplete = rows.filter((r) => r.configurationMissing.length > 0);
  const atRisk = rows.filter((r) => r.stockoutRisk);
  const active = requests.filter((r) => isSourcingActive(r.status));
  const awaitingApproval = requests.filter((r) => r.status === "AWAITING_APPROVAL");

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.03em] text-blue-700">Dashboard</h1>

      {awaitingApproval.length > 0 ? (
        <Card className="border-blue-300 bg-blue-50/60">
          <CardHeader>
            <CardTitle>Menunggu keputusan Anda</CardTitle>
            <CardDescription>
              Rekomendasi pembelian sudah siap. Tidak ada pesanan sebelum Anda menyetujuinya.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {awaitingApproval.map((r) => (
              <Link key={r.id} href={`/procurement/${r.id}`} className="font-medium text-primary underline underline-offset-4 hover:text-blue-800">
                Tinjau rekomendasi ({r.itemCount} barang, dibuat {formatDateTime(r.createdAt)})
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {settings.defaultRestockBudget <= 0 ? (
        <Card className="border-danger/30 bg-danger-bg">
          <CardContent className="py-4 text-sm">
            <strong>Restock Budget belum diatur.</strong> Restock yang terdeteksi tidak bisa diproses sebelum budget
            diisi. <Link href="/settings" className="font-medium text-primary underline underline-offset-4 hover:text-blue-800">Atur di Pengaturan</Link>.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Stat featured label="Barang perlu restock" value={needRestock.length} href="/inventory" />
        <Stat label="Proses sourcing aktif" value={active.length} href="/procurement" />
        <Stat label="PO menunggu penerimaan" value={openOrders.length} href="/receiving" />
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
                  <Link href={`/procurement/${r.id}`} className="font-medium text-primary underline underline-offset-4 hover:text-blue-800">
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
