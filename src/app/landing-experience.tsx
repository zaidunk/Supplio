"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronDown, CircleCheck, PackageCheck, PackageOpen, Send, SlidersHorizontal } from "lucide-react";
import "./landing-page.css";

const steps = [
  { title: "Stok mulai menipis", text: "Supplio melihat stok yang tersedia dan barang yang sedang datang, lalu menghitung kapan dan berapa banyak perlu diisi. Anda juga bisa meminta penawaran secara manual.", icon: PackageOpen },
  { title: "Supplier memberi penawaran", text: "Bot Telegram Supplio menghubungi supplier manusia. AI menjelaskan kebutuhan barang dan membaca balasan mereka.", icon: Send },
  { title: "Pilihan dihitung", text: "Sistem mencari kombinasi pembelian dengan total harga barang dan ongkir terendah yang memenuhi kebutuhan serta batas Anda.", icon: SlidersHorizontal },
  { title: "Anda memutuskan", text: "Tinjau supplier, jumlah, biaya, dan alasannya. Purchase order hanya dibuat setelah Final Approval dari pemilik.", icon: PackageCheck },
];

function ActionLink() {
  return <Link href="/login" className="lp-action">Masuk ke Supplio <ArrowUpRight aria-hidden="true" size={19} strokeWidth={1.75} /></Link>;
}

function Header() {
  const menuRef = useRef<HTMLDetailsElement>(null);
  return <header className="lp-header"><div className="lp-wrap lp-header-inner">
    <a className="lp-brand" href="#beranda" aria-label="Supplio, kembali ke atas">
      <Image className="lp-logo-wordmark" src="/brand/wordmark.svg" width={110} height={32} alt="Supplio" priority />
      <Image className="lp-logo-icon" src="/brand/icon.svg" width={34} height={33} alt="Supplio" priority />
    </a>
    <nav className="lp-desktop-nav" aria-label="Navigasi utama"><a href="#cara-kerja">Cara kerja</a><a href="#kemampuan">Kemampuan</a><a href="#kendali">Kendali Anda</a><a href="#pertanyaan">Pertanyaan</a></nav>
    <div className="lp-header-right"><Link href="/login" className="lp-header-login">Masuk <ArrowUpRight size={17} aria-hidden="true" /></Link>
      <details ref={menuRef} className="lp-mobile-menu" onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}><summary>Menu <ChevronDown size={18} aria-hidden="true" /></summary><nav aria-label="Navigasi seluler" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}><a href="#cara-kerja">Cara kerja</a><a href="#kemampuan">Kemampuan</a><a href="#kendali">Kendali Anda</a><a href="#pertanyaan">Pertanyaan</a><Link href="/login">Masuk ke Supplio</Link></nav></details>
    </div>
  </div></header>;
}

function Hero() {
  return <section className="lp-hero" id="beranda"><div className="lp-wrap lp-hero-inner">
    <div className="lp-hero-copy">
      <h1>Restock UMKM, keputusan tetap <span>Anda.</span></h1>
      <p>Supplio memantau stok, meminta penawaran supplier manusia lewat Telegram, lalu menyiapkan pilihan pembelian. Anda yang menyetujui.</p>
      <div className="lp-hero-actions"><ActionLink /><a className="lp-text-link" href="#cara-kerja">Lihat cara kerja <ArrowRight size={18} aria-hidden="true" /></a></div>
    </div>
    <figure className="lp-hero-art">
      <Image className="lp-hero-scene" src="/images/hero-restock-world.png" alt="Ilustrasi warung UMKM dengan stok beras, minyak, dan barang yang baru diantar" width={1536} height={1024} sizes="(max-width: 767px) 100vw, (max-width: 1200px) 55vw, 720px" priority />
      <Image className="lp-hero-plane" src="/images/hero-paper-plane.png" alt="" width={1536} height={1024} sizes="150px" aria-hidden="true" />
      <Image className="lp-hero-parcel" src="/images/hero-floating-parcel.png" alt="" width={1312} height={1199} sizes="150px" aria-hidden="true" unoptimized />
    </figure>
  </div></section>;
}

function Workflow() {
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let context: { revert: () => void } | undefined;
    let cancelled = false;
    async function start() {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled || !rail) return;
      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
        gsap.fromTo(".lp-rail-fill", { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: rail, start: "top 70%", end: "bottom 55%", scrub: true } });
      }, rail);
    }
    void start();
    return () => { cancelled = true; context?.revert(); };
  }, []);
  return <section className="lp-section lp-workflow" id="cara-kerja"><div className="lp-wrap lp-workflow-grid">
    <div className="lp-section-intro"><h2>Dari stok menipis sampai keputusan pembelian.</h2><p>Empat langkah yang terlihat jelas. Supplio mengurus pekerjaan berulang, sementara keputusan uang tetap di tangan Anda.</p></div>
    <div className="lp-steps" ref={railRef}><div className="lp-rail" aria-hidden="true"><span className="lp-rail-fill" /></div><ol>{steps.map((step, index) => { const Icon = step.icon; return <li key={step.title}><span className="lp-step-index" aria-hidden="true">{index + 1}</span><div className="lp-step-content"><div className="lp-step-title"><Icon size={24} strokeWidth={1.75} aria-hidden="true" /><h3>{step.title}</h3></div><p>{step.text}</p></div></li>; })}</ol></div>
  </div></section>;
}

function Capabilities() {
  return <section className="lp-section lp-capabilities" id="kemampuan"><div className="lp-wrap">
    <div className="lp-capabilities-heading"><h2>Yang perlu Anda lihat, ada di satu alur.</h2><p>Dari Inventory sampai Procurement, setiap status dan biaya bisa ditinjau sebelum Anda memutuskan.</p></div>
    <div className="lp-capability-grid">
      <article className="lp-capability lp-capability-stock">
        <div className="lp-capability-copy"><h3>Ketahui barang yang perlu diisi.</h3><p>Inventory memperlihatkan Current Stock, Incoming Quantity, dan kebutuhan restock dalam satu konteks. Anda juga dapat meminta penawaran lebih awal secara manual.</p></div>
        <figure className="lp-capability-visual"><Image src="/landing/assets/photos/inventory-shelves-pexels.webp" alt="Rak barang kebutuhan sehari-hari di sebuah toko kecil" width={1400} height={1000} sizes="(max-width: 767px) 100vw, 560px" loading="lazy" /><figcaption>Foto ilustratif: <a href="https://www.pexels.com/photo/cozy-corner-of-an-asian-grocery-store-interior-34357798/" target="_blank" rel="noopener noreferrer">Paolo Sanchez / Pexels</a></figcaption></figure>
      </article>
      <article className="lp-capability lp-capability-telegram">
        <div className="lp-capability-copy"><h3>Penawaran datang dari supplier manusia.</h3><p>Bot Telegram Supplio menyebut dirinya AI, meminta harga dan ketentuan kepada supplier manusia, lalu menyimpan balasannya sebagai Quotation.</p></div>
        <figure className="lp-capability-visual"><Image src="/landing/assets/photos/supplier-phone-pexels.webp" alt="Pelaku usaha berbicara lewat telepon sambil menyiapkan pesanan" width={1400} height={1000} sizes="(max-width: 767px) 100vw, 560px" loading="lazy" /><figcaption>Foto ilustratif: <a href="https://www.pexels.com/photo/a-woman-talking-on-her-phone-while-boxing-pastry-8902305/" target="_blank" rel="noopener noreferrer">ANTONI SHKRABA production / Pexels</a></figcaption></figure>
      </article>
      <article className="lp-capability lp-capability-choice">
        <div className="lp-capability-copy"><h3>Bandingkan biaya bersama batas pembelian.</h3><p>Rekomendasi membandingkan harga barang dan ongkir terhadap Restock Budget. Jika belum ada pilihan yang memenuhi batas, alasannya tetap terlihat.</p></div>
        <figure className="lp-capability-visual"><Image src="/landing/assets/photos/budget-calculator-pexels.webp" alt="Tangan menghitung biaya dengan kalkulator dan dokumen di meja" width={1400} height={1000} sizes="(max-width: 767px) 100vw, 560px" loading="lazy" /><figcaption>Foto ilustratif: <a href="https://www.pexels.com/photo/a-person-using-calculator-7654591/" target="_blank" rel="noopener noreferrer">Pavel Danilyuk / Pexels</a></figcaption></figure>
      </article>
    </div>
  </div></section>;
}

function OwnerControl() {
  return (
    <section className="lp-owner" id="kendali">
      <div className="lp-wrap lp-owner-grid">
        <div>
          <h2>
            AI menyiapkan pilihan.<br />Anda yang <span>menyetujui.</span>
          </h2>
          <p>
            Supplio dapat meminta penawaran dan melakukan paling banyak satu counter-offer per supplier. Sistem tidak memesan atau menjanjikan pembayaran atas nama Anda.
          </p>
        </div>
        <figure className="lp-owner-visual">
          <Image
            src="/landing/assets/photos/owner-review-pexels.webp"
            alt="Seorang perempuan memeriksa dokumen sebelum mengambil keputusan"
            width={1000}
            height={1000}
            sizes="(max-width: 767px) 100vw, 600px"
            className="lp-owner-image"
            loading="lazy"
          />
          <figcaption>Foto ilustratif: <a href="https://www.pexels.com/photo/a-woman-reading-a-document-6963840/" target="_blank" rel="noopener noreferrer">Mikhail Nilov / Pexels</a></figcaption>
        </figure>
      </div>
    </section>
  );
}

function TrustAndQuestions() {
  return <section className="lp-section lp-trust" id="pertanyaan"><div className="lp-wrap lp-trust-grid"><div><h2>Prosesnya terbuka untuk ditinjau.</h2><p>Status penawaran, batas pembelian, dan alasan rekomendasi tampil sebelum keputusan akhir.</p><div className="lp-trust-points"><p><CircleCheck size={20} aria-hidden="true" /> Supplier tahu pesan berasal dari AI Supplio.</p><p><CircleCheck size={20} aria-hidden="true" /> Batas biaya diperiksa oleh sistem.</p><p><CircleCheck size={20} aria-hidden="true" /> Pembelian menunggu persetujuan pemilik.</p></div></div><div className="lp-faq"><h3>Pertanyaan umum</h3><details><summary>Apakah Supplio memesan otomatis?<ChevronDown size={20} aria-hidden="true" /></summary><p>Supplio otomatis memantau stok dan meminta penawaran saat dibutuhkan. Pembelian tetap menunggu Final Approval dari pemilik.</p></details><details><summary>Siapa yang membalas pesan Telegram?<ChevronDown size={20} aria-hidden="true" /></summary><p>Supplier manusia membalas bot Telegram Supplio. Bot menyatakan bahwa pesannya dibuat oleh AI, bukan dari akun pribadi Anda.</p></details><details><summary>Bagaimana jika penawaran tidak sesuai batas?<ChevronDown size={20} aria-hidden="true" /></summary><p>Supplio tidak memaksakan pembelian. Anda akan melihat alasan tidak adanya kombinasi yang memenuhi kebutuhan dan batas yang ditetapkan.</p></details></div></div></section>;
}

function Footer() {
  return <footer className="lp-footer"><div className="lp-wrap"><div className="lp-footer-top"><div><h2>Mulai kelola restock dengan keputusan yang jelas.</h2><p>Masuk untuk melihat stok, penawaran supplier, dan rekomendasi pembelian usaha Anda.</p></div><ActionLink /></div><div className="lp-footer-bottom"><a href="#beranda" aria-label="Supplio, kembali ke atas"><Image src="/brand/wordmark.svg" alt="Supplio" width={110} height={32} /></a><nav aria-label="Navigasi footer"><a href="#cara-kerja">Cara kerja</a><a href="#kemampuan">Kemampuan</a><a href="#kendali">Kendali Anda</a></nav><span>© Supplio</span></div></div></footer>;
}

export default function LandingExperience() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    async function start() {
      const [{ default: Lenis }, { default: gsap }, { ScrollTrigger }] = await Promise.all([import("lenis"), import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, anchors: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      const context = gsap.context(() => {
        gsap.fromTo(".lp-owner-image", { y: 36, opacity: 0.65 }, { y: 0, opacity: 1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".lp-owner", start: "top 75%", once: true } });
      });
      ScrollTrigger.refresh();
      dispose = () => { context.revert(); gsap.ticker.remove(tick); lenis.destroy(); };
    }
    void start();
    return () => { cancelled = true; dispose?.(); };
  }, []);
  return <div className="supplio-landing-root"><a className="lp-skip" href="#konten">Lewati ke konten utama</a><Header /><main id="konten"><Hero /><Workflow /><Capabilities /><OwnerControl /><TrustAndQuestions /></main><Footer /></div>;
}
