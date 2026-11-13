import { SupplierForm } from "@/components/suppliers/supplier-form";
import { RemoveProductButton, ToggleActiveButton } from "@/components/suppliers/supplier-actions";
import { TelegramLinkButton } from "@/components/suppliers/telegram-link-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.03em] text-blue-700">Supplier</h1>
        <p className="mt-3 max-w-[68ch] text-base text-muted-foreground">
          Harga, MOQ, dan lead time di sini hanya referensi. Harga yang dipakai untuk rekomendasi berasal dari penawaran
          aktual supplier lewat Telegram.
        </p>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Belum ada supplier.</CardContent>
        </Card>
      ) : null}

      {suppliers.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{s.name}</CardTitle>
                <Badge variant={s.isActive ? "default" : "outline"}>{s.isActive ? "Aktif" : "Nonaktif"}</Badge>
                <Badge variant={s.telegramConnected ? "default" : "secondary"}>
                  {s.telegramConnected
                    ? `Telegram terhubung (${formatDateTime(s.telegramVerifiedAt!)})`
                    : "Telegram belum terhubung"}
                </Badge>
              </div>
              <ToggleActiveButton supplierId={s.id} isActive={s.isActive} />
            </div>
            <CardDescription>
              {s.telegramConnected
                ? "Supplier ini sudah bisa dihubungi oleh bot Supplio."
                : "Bot tidak bisa memulai chat lebih dulu: supplier harus membuka tautan onboarding dan menyetujui koneksi."}
            </CardDescription>
            <TelegramLinkButton supplierId={s.id} connected={s.telegramConnected} />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead className="text-right">Harga ref.</TableHead>
                    <TableHead className="text-right">MOQ</TableHead>
                    <TableHead className="text-right">Kemasan</TableHead>
                    <TableHead className="text-right">Stok ref.</TableHead>
                    <TableHead className="text-right">Lead time</TableHead>
                    <TableHead className="text-right">Ongkir ref.</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        Belum menyuplai produk apa pun.
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
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">Tambah / ubah produk yang disuplai</summary>
              <div className="pt-4">
                <SupplierForm products={products} supplierId={s.id} />
              </div>
            </details>
          </CardContent>
        </Card>
      ))}

      <Card>
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
