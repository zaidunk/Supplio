import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Supplio: restock UMKM dengan penawaran supplier yang dibandingkan AI",
  description:
    "Supplio memantau stok, meminta penawaran supplier lewat Telegram, lalu menyusun kombinasi pembelian berbiaya terendah. Pembelian hanya terjadi setelah pemilik menyetujui.",
};

const STEPS: { title: string; body: string }[] = [
  {
    title: "Stok mencapai Reorder Point",
    body: "Supplio menghitung Inventory Position, yaitu stok saat ini ditambah barang yang sudah dipesan, lalu membuat satu procurement request untuk semua barang yang perlu diisi ulang.",
  },
  {
    title: "AI meminta penawaran lewat Telegram",
    body: "Bot Supplio menghubungi supplier dan menyebut dirinya AI. Yang ditanyakan: harga, stok, MOQ (jumlah pesanan minimum), ongkir, dan lead time.",
  },
  {
    title: "Solver mencari total biaya terendah",
    body: "Solver memilih kombinasi supplier dengan total harga barang plus ongkir paling rendah, dalam batas Restock Budget dan Maximum Unit Price.",
  },
  {
    title: "Anda menyetujui, baru purchase order dibuat",
    body: "Rekomendasi menampilkan supplier, total, dan alasannya. Setelah Final Approval dari Anda, Supplio membuat satu purchase order per supplier.",
  },
];

const GUARDRAILS = [
  "AI tidak menyetujui pesanan.",
  "AI tidak menjanjikan pembayaran.",
  "AI tidak membuat komitmen atas nama Anda.",
  "Restock Budget dijaga oleh sistem, bukan oleh AI.",
];

function Logo({ className }: { className?: string }) {
  return <Image src="/brand/wordmark.svg" alt="Supplio" width={96} height={28} className={className} priority />;
}

function CtaLink({ children, className, pink }: { children: React.ReactNode; className?: string; pink?: boolean }) {
  return (
    <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8", pink && "bg-pink-600 text-white hover:bg-pink-700", className)}>
      {children}
      <ArrowRight className="size-4" />
    </Link>
  );
}

function Mascot() {
  return (
    <Image
      src="/brand/icon.svg"
      alt="Maskot Supplio"
      width={364}
      height={350}
      className="h-auto w-full"
      priority
    />
  );
}

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Link href="/" aria-label="Supplio, beranda" className="inline-flex h-10 items-center rounded-lg">
            <Logo />
          </Link>
          <CtaLink>Masuk</CtaLink>
        </div>
      </header>

      <main>
        <section className="relative overflow-clip bg-[image:var(--grad-wash)]">
          <div className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[7fr_5fr] lg:px-10 lg:py-28">
            <div>
              <h1 className="max-w-[16ch] text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02] font-medium tracking-[-0.035em] text-blue-700">
                Minta penawaran ke semua supplier, <span className="text-pink-600">tanpa chat satu per satu</span>
              </h1>
              <p className="mt-6 max-w-[52ch] text-lg text-muted-foreground">
                Supplio memantau stok UMKM Anda, meminta penawaran lewat Telegram, lalu menyusun kombinasi
                pembelian dengan total biaya terendah. Anda yang memutuskan.
              </p>
              <CtaLink className="mt-8">Masuk ke Supplio</CtaLink>
            </div>
            <Mascot />
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <h2 className="max-w-[22ch] text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.1] font-medium tracking-[-0.025em] text-blue-700">
            Dari stok menipis sampai pesanan, dalam empat langkah
          </h2>
          <ol className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-5">
                <span className="text-5xl leading-none font-medium tracking-[-0.03em] text-blue-300 tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-xl font-medium tracking-tight">{s.title}</h3>
                  <p className="mt-2 max-w-[48ch] text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-[image:var(--grad-blue)] text-white">
          <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[7fr_5fr] lg:px-10 lg:py-24">
            <div>
              <h2 className="max-w-[18ch] text-[clamp(1.75rem,3.4vw,3rem)] leading-[1.06] font-medium tracking-[-0.03em]">
                Keputusan akhir selalu di tangan Anda
              </h2>
              <p className="mt-5 max-w-[48ch] text-lg text-blue-100">
                Restock dan permintaan penawaran berjalan otomatis. Pembelian tidak: hanya pemilik yang bisa memberi
                Final Approval.
              </p>
            </div>
            <ul className="flex flex-col justify-center divide-y divide-white/20 border-y border-white/20">
              {GUARDRAILS.map((g) => (
                <li key={g} className="py-4 text-base font-medium">
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-4 py-20 text-center sm:px-6 lg:px-10 lg:py-28">
          <h2 className="mx-auto max-w-[20ch] text-[clamp(1.75rem,3.4vw,3rem)] leading-[1.08] font-medium tracking-[-0.03em] text-blue-700">
            Mulai dari stok yang sudah Anda catat
          </h2>
          <CtaLink pink className="mt-8">Masuk ke Supplio</CtaLink>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start justify-between gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-6">
          <Logo />
          <p className="text-sm text-muted-foreground">Inventory dan procurement berbantuan AI untuk UMKM.</p>
        </div>
      </footer>
    </div>
  );
}
