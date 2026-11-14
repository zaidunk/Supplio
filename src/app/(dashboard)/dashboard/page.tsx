import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ProductStatusBadge, RequestStatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/stat-card";
import { ButtonLink } from "@/components/ui/button-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/format";
import { listPurchaseOrders } from "@/lib/procurement/receiving";
import { getInventoryOverview } from "@/lib/inventory/overview";
import { isSourcingActive } from "@/lib/procurement/lifecycle";
import { listRequests } from "@/lib/procurement/queries";

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        actions={
          <ButtonLink href="/inventory?dialog=minta-penawaran" variant="outline">
            Minta penawaran manual
          </ButtonLink>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <StatCard
          featured
          className={awaitingApproval.length === 0 ? "lg:col-span-2" : undefined}
          label="Rekomendasi menunggu persetujuan Anda"
          value={awaitingApproval.length}
          href={awaitingApproval.length === 1 ? `/procurement/${awaitingApproval[0].id}` : "/procurement"}
        />
        {awaitingApproval.length > 0 ? (
          <Card className="h-full border-blue-300 bg-blue-50/60">
            <CardHeader>
              <CardTitle>Menunggu keputusan Anda</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {awaitingApproval.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span>
                    {r.itemCount} barang, dibuat {formatDateTime(r.createdAt)}
                  </span>
                  <ButtonLink href={`/procurement/${r.id}`}>
                    Tinjau dan putuskan
                  </ButtonLink>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {settings.defaultRestockBudget <= 0 ? (
        <Card className="border-danger/30 bg-danger-bg">
          <CardContent className="py-4 text-sm">
            <strong>Restock Budget belum diatur.</strong> Restock yang terdeteksi baru bisa diproses setelah budget
            diisi. <Link href="/settings" className="font-medium text-primary underline underline-offset-4 hover:text-blue-800">Atur Restock Budget</Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <StatCard label="Barang perlu restock" value={needRestock.length} href="/inventory" />
        <StatCard label="Procurement request aktif" value={active.length} href="/procurement" />
        <StatCard label="Purchase order menunggu penerimaan" value={openOrders.length} href="/receiving" />
        <StatCard label="Barang berisiko stockout" value={atRisk.length} href="/inventory" />
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        {incomplete.length > 0 ? (
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Konfigurasi belum lengkap</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {incomplete.map((r) => (
                <ProductStatusBadge key={r.id} kind="incomplete">
                  {r.name}
                </ProductStatusBadge>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className={incomplete.length === 0 ? "h-full lg:col-span-2" : "h-full"}>
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
    </div>
  );
}
