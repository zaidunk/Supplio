import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Format email belum benar atau kata sandi kosong. Periksa isian Anda, lalu coba lagi.",
  credentials: "Email atau kata sandi tidak cocok. Periksa kembali, lalu coba masuk lagi.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="grid flex-1 lg:grid-cols-[7fr_5fr]">
      <section className="relative hidden overflow-clip bg-[image:var(--grad-wash)] lg:flex lg:flex-col lg:justify-between lg:px-16 lg:py-12">
        <Image src="/brand/wordmark.svg" alt="Supplio" width={108} height={31} priority />
        <Image src="/brand/icon.svg" alt="" width={192} height={185} className="self-center" priority />
        <div className="flex flex-col gap-6">
          <h1 className="max-w-[14ch] text-[clamp(2.5rem,4.5vw,4.5rem)] leading-[1.02] font-medium tracking-[-0.035em] text-blue-700">
            Restock lebih <span className="text-pink-500">terkendali</span>
          </h1>
          <p className="max-w-[44ch] text-lg text-muted-foreground">
            AI meminta dan membandingkan penawaran supplier. Pembelian baru terjadi setelah Anda menyetujuinya.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <Card className="w-full max-w-[420px] shadow-md [--card-spacing:--spacing(8)]">
          <CardHeader>
            <Image src="/brand/icon.svg" alt="" width={48} height={46} className="mb-2 lg:hidden" priority />
            <CardTitle className="text-2xl">Masuk ke Supplio</CardTitle>
            <CardDescription>Gunakan akun pemilik UMKM.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signIn} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Kata sandi</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              {message ? (
                <p role="alert" className="text-sm font-medium text-danger">
                  {message}
                </p>
              ) : null}
              <Button type="submit" size="lg" className="rounded-full">
                Masuk
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
