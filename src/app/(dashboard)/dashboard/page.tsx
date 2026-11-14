import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RequestStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/format";
import { listPurchaseOrders } from "@/lib/procurement/receiving";
import { getInventoryOverview } from "@/lib/inventory/overview";
import { isSourcingActive } from "@/lib/procurement/lifecycle";
import { listRequests } from "@/lib/procurement/queries";

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
                ? "text-[clamp(2.5rem,5vw,3.5rem)] leading-none font-medium tracking-[-0.03em] tabular-nums"
                : "text-2xl leading-none font-medium tracking-[-0.02em] tabular-nums xl:text-3xl"
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
      <PageHeader
        title="Dashboard"
        actions={
          <Link href="/inventory#minta-penawaran" className={buttonVariants({ variant: "outline" })}>
            Minta penawaran manual
          </Link>
        }
      />

      {awaitingApproval.length > 0 ? (
        <Card className="border-blue-300 bg-blue-50/60">
          <CardHeader>
            <CardTitle>Menunggu keputusan Anda</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {awaitingApproval.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>
                  {r.itemCount} barang, dibuat {formatDateTime(r.createdAt)}
                </span>
                <Link href={`/procurement/${r.id}`} className={buttonVariants()}>
                  Tinjau dan putuskan
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {settings.defaultRestockBudget <= 0 ? (
        <Card className="border-danger/30 bg-danger-bg">
          <CardContent className="py-4 text-sm">
            <strong>Restock Budget belum diatur.</strong> Restock yang terdeteksi baru bisa diproses setelah budget
            diisi. <Link href="/settings" className="font-medium text-primary underline underline-offset-4 hover:text-blue-800">Atur Restock Budget</Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Stat
          featured
          label="Rekomendasi menunggu persetujuan Anda"
          value={awaitingApproval.length}
          href={awaitingApproval.length === 1 ? `/procurement/${awaitingApproval[0].id}` : "/procurement"}
        />
        <Stat label="Barang perlu restock" value={needRestock.length} href="/inventory" />
        <Stat label="Procurement request aktif" value={active.length} href="/procurement" />
        <Stat label="Purchase order menunggu penerimaan" value={openOrders.length} href="/receiving" />
        <Stat label="Barang berisiko stockout" value={atRisk.length} href="/inventory" />
      </div>

      {incomplete.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Konfigurasi belum lengkap</CardTitle>
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
          <CardTitle>Procurement request terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <EmptyState
              title="Belum ada procurement request"
              action={{ href: "/inventory", label: "Lihat Inventory" }}
            />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {requests.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  <RequestStatusBadge status={r.status} />
                  <Link href={`/procurement/${r.id}`} className="font-medium text-primary underline underline-offset-4 hover:text-blue-800">
                    {r.itemCount} barang, dibuat {formatDateTime(r.createdAt)}
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
