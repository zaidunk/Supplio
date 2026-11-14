import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { RemoveProductButton, ToggleActiveButton } from "@/components/suppliers/supplier-actions";
import { TelegramLinkButton } from "@/components/suppliers/telegram-link-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatQty, formatRupiah } from "@/lib/format";
import { listSuppliers } from "@/lib/suppliers/service";

export default async function SuppliersPage() {
  const business = await requireBusiness();
  const [suppliers, products] = await Promise.all([
    listSuppliers(prisma, business.id),
    prisma.product.findMany({
      where: { businessId: business.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Supplier"
      />

      {suppliers.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Belum ada supplier"
              action={{ href: "#tambah-supplier", label: "Tambah supplier" }}
            />
          </CardContent>
        </Card>
      ) : null}

      {suppliers.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{s.name}</CardTitle>
                <Badge variant={s.isActive ? "success" : "outline"}>{s.isActive ? "Aktif" : "Nonaktif"}</Badge>
                {s.telegramConnected ? (
                  <Badge variant="success">Telegram terhubung ({formatDateTime(s.telegramVerifiedAt!)})</Badge>
                ) : null}
                <span className="text-sm text-muted-foreground">{s.products.length} produk</span>
              </div>
              <ToggleActiveButton supplierId={s.id} isActive={s.isActive} />
            </div>
            {s.telegramConnected ? (
              <>
                <TelegramLinkButton supplierId={s.id} connected />
              </>
            ) : (
              <div role="status" className="mt-2 flex flex-col gap-3 rounded-xl bg-warning-bg p-4 text-sm">
                <p className="text-warning">
                  <strong>Telegram belum terhubung.</strong> Supplio tidak bisa memulai chat lebih dulu. Kirim tautan
                  onboarding ke supplier; supplier perlu membukanya dan menyetujui koneksi.
                </p>
                <TelegramLinkButton supplierId={s.id} connected={false} />
              </div>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <details open={suppliers.length <= 2} className="rounded-md border">
              <summary className="cursor-pointer p-3 text-sm font-medium">Produk yang disuplai ({s.products.length})</summary>
              <div className="border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead className="text-right">Harga referensi</TableHead>
                      <TableHead className="text-right">MOQ</TableHead>
                      <TableHead className="text-right">Isi kemasan</TableHead>
                      <TableHead className="text-right">Stok referensi</TableHead>
                      <TableHead className="text-right">Lead time</TableHead>
                      <TableHead className="text-right">Ongkir referensi</TableHead>
                      <TableHead>Peran</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Belum ada produk. Tambahkan lewat “Tambah atau ubah produk supplier” di bawah.
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {s.products.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell className="font-medium">
                          {p.productName} <span className="text-muted-foreground">({p.unit})</span>
                        </TableCell>
                        <TableCell className="text-right">{formatRupiah(p.referenceUnitPrice)}</TableCell>
                        <TableCell className="text-right">{formatQty(p.minimumOrderQuantity)}</TableCell>
                        <TableCell className="text-right">{formatQty(p.packSize)}</TableCell>
                        <TableCell className="text-right">{formatQty(p.referenceAvailableQuantity)}</TableCell>
                        <TableCell className="text-right">{p.referenceLeadTimeDays} hari</TableCell>
                        <TableCell className="text-right">
                          {p.referenceShippingFee === null ? "-" : formatRupiah(p.referenceShippingFee)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.isPrimary ? "default" : "outline"}>{p.isPrimary ? "Utama" : "Alternatif"}</Badge>
                        </TableCell>
                        <TableCell>
                          <RemoveProductButton supplierId={s.id} productId={p.productId} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">Tambah atau ubah produk supplier</summary>
              <div className="pt-4">
                <SupplierForm products={products} supplierId={s.id} />
              </div>
            </details>
          </CardContent>
        </Card>
      ))}

      <Card id="tambah-supplier" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Tambah supplier</CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierForm products={products} />
        </CardContent>
      </Card>
    </div>
  );
}
