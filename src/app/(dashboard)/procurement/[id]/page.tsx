import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ApprovalPanel } from "@/components/procurement/approval-panel";
import { ProgressStepper } from "@/components/procurement/progress-stepper";
import { ResendConfirmationButton } from "@/components/procurement/resend-confirmation-button";
import { PoStatusBadge, RequestStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { formatDateTime, formatQty, formatRupiah } from "@/lib/format";
import { getRequestDetail } from "@/lib/procurement/queries";
import { idSchema } from "@/lib/validation/common";
import { QUOTATION_STATUS_LABEL, SESSION_STATUS_LABEL, STATUS_LABEL } from "@/lib/ui/status";

function Figure({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl border p-4 ${emphasis ? "border-transparent bg-blue-50" : "border-line"}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl leading-none font-medium tracking-[-0.02em] tabular-nums xl:text-3xl">{value}</span>
    </div>
  );
}

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

  const rec = request.recommendation;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Procurement request"
          back={{ href: "/procurement", label: "← Semua request" }}
          badge={<RequestStatusBadge status={request.status} />}
          meta={
            <>
              Dibuat {formatDateTime(request.createdAt)} · Restock Budget {formatRupiah(request.restockBudget)} (snapshot) ·
              Pengaturan AI v{request.aiSettingsVersion}
              {request.expiresAt ? ` · Kedaluwarsa ${formatDateTime(request.expiresAt)}` : ""}
            </>
          }
        />
        <ProgressStepper status={request.status} />
      </div>

      {rec ? (
        <Card className={request.status === "AWAITING_APPROVAL" ? "border-blue-300" : undefined}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Rekomendasi pembelian</CardTitle>
              <Badge variant={rec.solverStatus === "OPTIMAL" ? "success" : "destructive"}>
                {rec.solverStatus === "OPTIMAL" ? "Kombinasi termurah ditemukan" : "Tidak ada solusi valid"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {rec.solverStatus === "OPTIMAL" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Figure emphasis label="Total biaya (termasuk ongkir)" value={formatRupiah(rec.totalCost)} />
                  <Figure label="Sisa Restock Budget" value={formatRupiah(rec.remainingBudget)} />
                  <Figure label="Supplier terpilih" value={String(rec.suppliers.length)} />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Barang</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="text-right">Harga satuan</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rec.suppliers.flatMap((s) => [
                      ...s.items.map((i, idx) => (
                        <TableRow key={`${s.supplierId}-${i.productName}`}>
                          <TableCell className="font-medium">{idx === 0 ? s.supplierName : ""}</TableCell>
                          <TableCell>{i.productName}</TableCell>
                          <TableCell className="text-right">
                            {formatQty(i.quantity)} {i.unit}
                          </TableCell>
                          <TableCell className="text-right">{formatRupiah(i.unitPrice)}</TableCell>
                          <TableCell className="text-right">{formatRupiah(i.lineCost)}</TableCell>
                        </TableRow>
                      )),
                      <TableRow key={`${s.supplierId}-ongkir`} className="text-muted-foreground">
                        <TableCell />
                        <TableCell colSpan={3}>Ongkir {s.supplierName} (dihitung sekali)</TableCell>
                        <TableCell className="text-right">{formatRupiah(s.shippingFee)}</TableCell>
                      </TableRow>,
                    ])}
                    <TableRow className="font-medium">
                      <TableCell colSpan={4}>Total</TableCell>
                      <TableCell className="text-right">{formatRupiah(rec.totalCost)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </>
            ) : null}

            <div className="flex flex-col gap-2 rounded-xl bg-surface-sunken p-4">
              <p className="text-sm font-medium">Alasan pemilihan</p>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
                {rec.explanation
                  .split("\n")
                  .filter((line) => line.trim() !== "")
                  .map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
              </ul>
            </div>

            {request.status === "AWAITING_APPROVAL" && rec.solverStatus === "OPTIMAL" ? (
              <ApprovalPanel
                key={rec.id}
                requestId={request.id}
                recommendationId={rec.id}
                totalCost={rec.totalCost}
                remainingBudget={rec.remainingBudget}
                suppliers={rec.suppliers.map((s) => ({
                  supplierName: s.supplierName,
                  itemCount: s.items.length,
                  subtotal: s.total,
                }))}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {request.status === "DRAFT" && request.sessions.length === 0 ? (
        <Card className="border-amber-500/50">
          <CardContent className="py-4 text-sm">
            <strong>Menunggu supplier terhubung.</strong> Belum ada supplier yang menyuplai barang ini dan sudah terhubung ke
            Telegram. Hubungkan supplier di <Link href="/suppliers" className="font-medium text-primary underline underline-offset-4 hover:text-blue-800">halaman Supplier</Link>; permintaan
            penawaran dikirim otomatis begitu ada yang terhubung.
          </CardContent>
        </Card>
      ) : null}

      {request.purchaseOrders.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Purchase order</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {request.purchaseOrders.map((po) => (
              <div key={po.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3 text-sm">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{po.poNumber}</span>
                    <PoStatusBadge status={po.status} />
                  </div>
                  <p className="text-muted-foreground">
                    {po.supplierName} · total {formatRupiah(po.totalCost)} (ongkir {formatRupiah(po.shippingFee)})
                  </p>
                  <ul className="mt-1">
                    {po.items.map((i) => (
                      <li key={i.productId}>
                        {i.productName}: dipesan {formatQty(i.ordered)} · diterima {formatQty(i.received)} · sisa {formatQty(i.outstanding)} {i.unit}
                      </li>
                    ))}
                  </ul>
                </div>
                {po.status === "CREATED" && !po.sentAt ? <ResendConfirmationButton purchaseOrderId={po.id} /> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {request.sessions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Percakapan supplier</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {request.sessions.map((s) => (
              <details key={s.id} open={!rec} className="group rounded-md border">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3">
                  <span className="font-medium">{s.supplierName}</span>
                  <Badge variant={s.status === "CONFIRMED" ? "success" : s.status === "DECLINED" || s.status === "TIMED_OUT" ? "outline" : "secondary"}>
                    {SESSION_STATUS_LABEL[s.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {s.messages.length} pesan · {s.quotations.length} penawaran
                  </span>
                  {s.expiresAt ? (
                    <span className="text-xs text-muted-foreground">batas balasan {formatDateTime(s.expiresAt)}</span>
                  ) : null}
                </summary>
                <div className="flex flex-col gap-3 border-t p-3">
                  {s.quotations.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {s.quotations.map((q) => (
                        <div key={q.id} className="rounded-md border p-2 text-sm">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge variant={q.status === "CONFIRMED" ? "success" : "outline"}>{QUOTATION_STATUS_LABEL[q.status]}</Badge>
                            {q.status === "CONFIRMED" ? (
                              <span className="text-xs text-muted-foreground">
                                ongkir {q.shippingFee === null ? "-" : formatRupiah(q.shippingFee)} · lead time {q.leadTimeDays ?? "-"} hari
                              </span>
                            ) : null}
                          </div>
                          {q.items.length > 0 ? (
                            <ul className="flex flex-col gap-0.5">
                              {q.items.map((i) => (
                                <li key={i.productName}>
                                  {i.productName}: {formatRupiah(i.quotedUnitPrice)}/{i.unit} · stok {formatQty(i.availableQuantity)} · MOQ{" "}
                                  {formatQty(i.minimumOrderQuantity)}
                                  {i.packSize ? ` · kemasan ${formatQty(i.packSize)}` : ""}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {s.messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada pesan.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {s.messages.map((m) => (
                        <li
                          key={m.id}
                          className={`max-w-prose rounded-md px-3 py-2 text-sm ${m.direction === "OUTBOUND" ? "self-start bg-muted" : "self-end border"}`}
                        >
                          <div className="mb-0.5 text-xs text-muted-foreground">
                            {m.sender === "SUPPLIER" ? s.supplierName : m.sender === "AI" ? "Asisten AI Supplio" : "Sistem"} ·{" "}
                            {formatDateTime(m.createdAt)}
                          </div>
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Kebutuhan</CardTitle>
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
