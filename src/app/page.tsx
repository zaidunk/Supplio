import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Boxes,
  Calculator,
  ClipboardCheck,
  PackageCheck,
  Send,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Supplio: restock UMKM kuliner dengan penawaran supplier yang dibandingkan AI",
  description:
    "Supplio memantau stok, meminta penawaran supplier lewat Telegram, lalu menyusun kombinasi pembelian berbiaya terendah. Pembelian hanya terjadi setelah pemilik menyetujui.",
};

const STEPS: { title: string; body: string }[] = [
  {
    title: "Stok mencapai reorder point",
    body: "Supplio menghitung posisi stok (stok ditambah barang dalam PO) dan membuat satu request untuk semua barang yang perlu diisi ulang.",
  },
  {
    title: "AI meminta penawaran lewat Telegram",
    body: "Bot Supplio menghubungi supplier dan menyebut dirinya AI. Harga, stok, MOQ, ongkir, dan lead time ditanyakan, dengan maksimal satu counter-offer per supplier.",
  },
  {
    title: "Kode menghitung kombinasi terendah",
    body: "Solver mencari total harga barang ditambah ongkir yang paling rendah, dalam batas Restock Budget dan Maximum Unit Price.",
  },
  {
    title: "Anda menyetujui, baru PO dibuat",
    body: "Tinjau rekomendasi, lalu setujui atau tolak. Stok bertambah hanya saat barang benar-benar diterima.",
  },
];

const FEATURES: { icon: LucideIcon; title: string; body: string; wide?: boolean }[] = [
  {
    icon: Boxes,
    title: "Inventory dan restock otomatis",
    body: "Catat produk dan mutasi stok. Reorder Point, Target Stock, dan Required Quantity dihitung dari konsumsi harian, lead time, dan Safety Stock Anda. Barang yang sudah ada di PO tidak diminta dua kali.",
    wide: true,
  },
  {
    icon: Send,
    title: "Negosiasi dengan supplier manusia",
    body: "Supplier membalas di Telegram dengan bahasa biasa. Jika harga atau satuan belum jelas, AI meminta klarifikasi.",
  },
  {
    icon: Calculator,
    title: "Rekomendasi yang bisa dijelaskan",
    body: "Setiap rekomendasi menampilkan supplier, kuantitas, harga, ongkir, total, sisa budget, dan alasan pemilihannya.",
  },
  {
    icon: ClipboardCheck,
    title: "Satu PO per supplier terpilih",
    body: "Setelah Anda menyetujui, PO dibuat per supplier. Penerimaan sebagian atau penuh dicatat dan memperbarui stok.",
  },
  {
    icon: PackageCheck,
    title: "Status selalu terlihat",
    body: "Menunggu balasan, perlu klarifikasi, atau tidak ada solusi valid: semua tampil di dashboard, bukan proses tersembunyi.",
    wide: true,
  },
];

const GUARDRAILS = [
  "AI tidak menyetujui pesanan.",
  "AI tidak menjanjikan pembayaran.",
  "AI tidak membuat komitmen atas nama Anda.",
  "Batas Restock Budget dijaga kode, bukan prompt.",
];

const NAV_ANCHORS = [
  { label: "Cara kerja", href: "#cara-kerja" },
  { label: "Fitur", href: "#fitur" },
  { label: "Kendali Anda", href: "#kendali" },
];

function Logo({ className }: { className?: string }) {
  return <Image src="/brand/wordmark.svg" alt="Supplio" width={96} height={28} className={className} priority />;
}

function RecommendationMock() {
  const rows = [
    { supplier: "Supplier A", item: "Beras 25 kg", total: "Rp 1.450.000" },
    { supplier: "Supplier B", item: "Minyak goreng 12 liter", total: "Rp 2.100.000" },
  ];
  return (
    <div className="rounded-3xl border border-blue-300/60 bg-card p-6 shadow-lg sm:p-8">
      <Badge variant="brand">Rekomendasi</Badge>
      <h3 className="mt-4 text-xl font-bold tracking-tight">Pembelian dari 2 supplier</h3>
      <ul className="mt-5 flex flex-col divide-y divide-line">
        {rows.map((r) => (
          <li key={r.supplier} className="flex items-baseline justify-between gap-4 py-3 text-sm">
            <span>
              <span className="font-semibold">{r.supplier}</span>
              <span className="block text-muted-foreground">{r.item}</span>
            </span>
            <span className="font-semibold tabular-nums">{r.total}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-end justify-between gap-4 border-t border-line-strong pt-4">
        <span className="text-sm text-muted-foreground">Total + ongkir</span>
        <span className="text-2xl leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap text-blue-700 tabular-nums sm:text-3xl">
          Rp 3.800.000
        </span>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Contoh tampilan, data simulasi.</p>
    </div>
  );
}

function ChatMock() {
  return (
    <div className="max-w-[270px] rounded-2xl border border-line bg-surface-raised p-4 shadow-md">
      <p className="text-xs font-semibold text-blue-700">AI Supplio untuk UMKM Anda</p>
      <p className="mt-1.5 text-sm leading-relaxed">
        Halo, kami butuh 25 kg beras untuk dikirim dalam 3 hari. Berapa harga per kg dan ongkirnya?
      </p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Link href="/" aria-label="Supplio, beranda">
            <Logo />
          </Link>
          <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">
            {NAV_ANCHORS.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="inline-flex h-10 items-center rounded-xl px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-blue-50/60 hover:text-foreground"
              >
                {a.label}
              </a>
            ))}
          </nav>
          <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Masuk
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-clip bg-[image:var(--grad-wash)]">
          <div className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[7fr_5fr] lg:px-10 lg:py-28">
            <div>
              <h1 className="max-w-[16ch] text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02] font-extrabold tracking-[-0.035em] text-blue-700">
                Minta penawaran ke semua supplier, <span className="text-pink-500">tanpa chat satu per satu</span>
              </h1>
              <p className="mt-6 max-w-[52ch] text-lg text-muted-foreground">
                Supplio memantau stok UMKM kuliner Anda, meminta penawaran lewat Telegram, lalu menyusun kombinasi
                pembelian dengan total biaya terendah. Anda yang memutuskan.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8")}>
                  Masuk ke Supplio
                </Link>
                <a
                  href="#cara-kerja"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full px-8")}
                >
                  Lihat cara kerja
                </a>
              </div>
            </div>

            <div className="relative pb-16 lg:pb-0 lg:mb-24">
              <div className="lg:rotate-[1.5deg]">
                <RecommendationMock />
              </div>
              <div className="absolute -bottom-2 left-0 sm:left-6 lg:-bottom-28 lg:-left-16 lg:-rotate-2">
                <ChatMock />
              </div>
            </div>
          </div>
        </section>

        <section
          id="cara-kerja"
          className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-4 py-20 sm:px-6 lg:px-10 lg:py-28"
        >
          <h2 className="max-w-[22ch] text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.1] font-extrabold tracking-[-0.025em] text-blue-700">
            Dari stok menipis sampai pesanan, dalam empat langkah
          </h2>
          <ol className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-5">
                <span className="text-5xl leading-none font-extrabold tracking-[-0.03em] text-blue-300 tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-xl font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-2 max-w-[48ch] text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="fitur" className="scroll-mt-20 bg-surface-sunken">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
            <h2 className="max-w-[22ch] text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.1] font-extrabold tracking-[-0.025em] text-blue-700">
              Semua yang dibutuhkan untuk satu siklus restock
            </h2>
            <div className="mt-12 grid gap-4 md:grid-cols-6">
              {FEATURES.map((f) => (
                <article
                  key={f.title}
                  className={cn(
                    "rounded-2xl border border-line bg-surface-raised p-8",
                    f.wide ? "md:col-span-4" : "md:col-span-2",
                  )}
                >
                  <f.icon className="size-6 text-blue-700" strokeWidth={1.75} aria-hidden="true" />
                  <h3 className="mt-5 text-xl font-bold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-muted-foreground">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="kendali"
          className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-4 py-20 sm:px-6 lg:px-10 lg:py-28"
        >
          <div className="grid gap-10 overflow-clip rounded-[2rem] bg-[image:var(--grad-blue)] p-8 text-white sm:p-12 lg:grid-cols-[7fr_5fr] lg:p-16">
            <div>
              <ShieldCheck className="size-8 text-pink-300" strokeWidth={1.75} aria-hidden="true" />
              <h2 className="mt-6 max-w-[18ch] text-[clamp(1.75rem,3.4vw,3rem)] leading-[1.06] font-extrabold tracking-[-0.03em]">
                Keputusan akhir selalu di tangan Anda
              </h2>
              <p className="mt-5 max-w-[48ch] text-lg text-blue-100">
                Restock dan permintaan penawaran berjalan otomatis. Pembelian tidak: hanya pemilik yang bisa memberi
                Final Approval.
              </p>
            </div>
            <ul className="flex flex-col justify-center gap-4">
              {GUARDRAILS.map((g) => (
                <li key={g} className="rounded-2xl bg-white/10 px-5 py-4 text-base font-medium backdrop-blur-sm">
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-4 pb-20 text-center sm:px-6 lg:px-10 lg:pb-28">
          <Image src="/brand/icon.svg" alt="" width={64} height={61} className="mx-auto" />
          <h2 className="mx-auto mt-6 max-w-[20ch] text-[clamp(1.75rem,3.4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.03em] text-blue-700">
            Mulai dari stok yang sudah Anda catat
          </h2>
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "mt-8 rounded-full px-8")}>
            Masuk ke Supplio
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start justify-between gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-6 lg:px-10">
          <Logo />
          <p className="text-sm text-muted-foreground">AI-assisted inventory dan procurement untuk UMKM.</p>
        </div>
      </footer>
    </div>
  );
}
