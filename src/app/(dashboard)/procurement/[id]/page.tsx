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
import { QUOTATION_STATUS_LABEL, SESSION_STATUS_LABEL, STATUS_LABEL } from "@/lib/ui/status";

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

      {request.status === "DRAFT" && request.sessions.length === 0 ? (
        <Card className="border-amber-500/50">
          <CardContent className="py-4 text-sm">
            <strong>Menunggu supplier terhubung.</strong> Belum ada supplier yang menyuplai barang ini dan sudah terhubung ke
            Telegram. Hubungkan supplier di <Link href="/suppliers" className="underline">halaman Supplier</Link>; permintaan
            penawaran dikirim otomatis begitu ada yang terhubung.
          </CardContent>
        </Card>
      ) : null}

      {request.sessions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Percakapan supplier</CardTitle>
            <CardDescription>
              Pesan supplier ditampilkan apa adanya sebagai data percakapan. Penawaran terstruktur di atas adalah hasil ekstraksi AI yang divalidasi kode; hanya yang berstatus terkonfirmasi yang dipakai optimasi.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {request.sessions.map((s) => (
              <div key={s.id} className="rounded-md border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.supplierName}</span>
                  <Badge variant="secondary">{SESSION_STATUS_LABEL[s.status]}</Badge>
                  {s.expiresAt ? (
                    <span className="text-xs text-muted-foreground">batas balasan {formatDateTime(s.expiresAt)}</span>
                  ) : null}
                </div>
                {s.quotations.length > 0 ? (
                  <div className="mb-3 flex flex-col gap-2">
                    {s.quotations.map((q) => (
                      <div key={q.id} className="rounded-md border p-2 text-sm">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge variant={q.status === "CONFIRMED" ? "default" : "outline"}>{QUOTATION_STATUS_LABEL[q.status]}</Badge>
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
            ))}
          </CardContent>
        </Card>
      ) : null}

      {request.recommendation ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Hasil optimasi</CardTitle>
              <Badge variant={request.recommendation.solverStatus === "OPTIMAL" ? "default" : "destructive"}>
                {request.recommendation.solverStatus === "OPTIMAL" ? "Kombinasi termurah ditemukan" : "Tidak ada solusi valid"}
              </Badge>
            </div>
            <CardDescription>
              Belum ada komitmen order. Persetujuan akhir ada pada Anda (menyusul di fase berikutnya).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {request.recommendation.solverStatus === "OPTIMAL" ? (
              <p className="mb-3 text-sm">
                Total {formatRupiah(request.recommendation.totalCost)} · sisa budget {formatRupiah(request.recommendation.remainingBudget)}
              </p>
            ) : null}
            <ul className="flex flex-col gap-1.5 text-sm">
              {request.recommendation.explanation.split("\n").map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

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
