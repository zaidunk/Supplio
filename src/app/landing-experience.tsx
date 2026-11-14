"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, CircleCheck, PackageCheck, PackageOpen, Send, ShieldCheck, SlidersHorizontal } from "lucide-react";
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

const heroTraces = [
  "M-80 90H320Q340 90 340 110V170Q340 190 360 190H720",
  "M-80 255H165Q190 255 190 280V340Q190 365 215 365H760",
  "M-80 480H360Q380 480 380 455V415Q380 390 405 390H760",
  "M-80 710H260Q285 710 285 685V630Q285 605 310 605H760",
  "M140 -50V110Q140 130 165 130H500Q525 130 525 155V265Q525 290 550 290H760",
  "M420 850V745Q420 720 445 720H555Q580 720 580 695V560Q580 535 605 535H760",
  "M600 -50V75Q600 100 625 100H760",
  "M650 850V750Q650 725 675 725H760",
];

function HeroCircuit() {
  return <svg className="lp-hero-circuit" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    {[0, 1].map((side) => <g key={side} transform={side ? "translate(1440 0) scale(-1 1)" : undefined}>
      {heroTraces.map((path, index) => <g key={path}>
        <path className="lp-hero-trace" d={path} />
        <path className="lp-hero-pulse" d={path} pathLength={100} style={{ animationDelay: `-${index * 1.4 + side * 2}s` }} />
      </g>)}
    </g>)}
  </svg>;
}

function Hero() {
  return <section className="lp-hero" id="beranda"><HeroCircuit /><div className="lp-wrap lp-hero-inner">
    <div className="lp-hero-copy">
      <h1>Restock UMKM, keputusan tetap <span>Anda.</span></h1>
      <p>Supplio memantau stok, meminta penawaran supplier manusia lewat Telegram, lalu menyiapkan pilihan pembelian. Anda yang menyetujui.</p>
      <div className="lp-hero-actions"><ActionLink /><a className="lp-text-link" href="#cara-kerja">Lihat cara kerja <ArrowRight size={18} aria-hidden="true" /></a></div>
      <p className="lp-hero-assurance"><ShieldCheck size={19} aria-hidden="true" /> AI tidak dapat menyetujui pembelian atas nama Anda.</p>
    </div>
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
      <article className="lp-capability lp-capability-stock"><div className="lp-capability-copy"><h3>Ketahui barang yang perlu diisi.</h3><p>Inventory menunjukkan Current Stock (stok tersedia), Incoming Quantity (barang yang sedang datang), dan kebutuhan restock. Jika perlu, minta penawaran lebih awal secara manual.</p></div>
        <div className="lp-stock-ui" data-ui aria-label="Contoh daftar stok, data simulasi"><div className="lp-ui-heading"><span>Inventory</span><small>Data simulasi</small></div><div className="lp-stock-row"><span><strong>Beras</strong><small>Inventory Position</small></span><strong>8 kg</strong><span className="lp-stock-warning">Perlu restock</span></div><div className="lp-stock-row"><span><strong>Minyak goreng</strong><small>Inventory Position</small></span><strong>16 liter</strong><span className="lp-stock-ok">Cukup</span></div><p>Reorder Point Beras: 10 kg</p></div>
      </article>
      <article className="lp-capability lp-capability-telegram"><div className="lp-capability-copy"><h3>Penawaran datang dari supplier manusia.</h3><p>Bot Telegram Supplio menyebut identitas AI dengan jelas, meminta harga dan ketentuan, lalu menyimpan jawaban supplier sebagai Quotation.</p></div>
        <div className="lp-chat-ui" data-ui aria-label="Contoh percakapan penawaran, data simulasi"><div className="lp-ui-heading"><span>Penawaran supplier</span><small>Data simulasi</small></div><div className="lp-chat-bubble lp-chat-ai"><strong>AI Supplio</strong><p>Apakah tersedia Beras 20 kg? Mohon harga, ongkir, dan perkiraan tiba.</p></div><div className="lp-chat-bubble lp-chat-supplier"><strong>Supplier A · manusia</strong><p>Tersedia 20 kg. Harga Rp 18.000/kg, ongkir Rp 20.000.</p></div><span className="lp-chat-status"><CircleCheck size={15} aria-hidden="true" /> Balasan supplier tercatat</span></div>
      </article>
      <article className="lp-capability lp-capability-choice"><div className="lp-capability-copy"><h3>Bandingkan biaya bersama batas pembelian.</h3><p>Rekomendasi menghitung harga barang dan ongkir, lalu memeriksa Restock Budget, yaitu batas total biaya untuk satu permintaan. Jika tidak ada pilihan yang memenuhi batas, Supplio menjelaskannya.</p></div>
        <div className="lp-choice-ui" data-ui aria-label="Contoh ringkasan rekomendasi, data simulasi"><span className="lp-choice-label">Rekomendasi · Data simulasi</span><strong className="lp-choice-total">Rp 380.000</strong><span>Harga barang + ongkir</span><div className="lp-choice-bottom"><span><Check size={16} aria-hidden="true" /> Sesuai Restock Budget</span><span>Menunggu Final Approval</span></div></div>
      </article>
    </div>
  </div></section>;
}

function OwnerControl() {
  return <section className="lp-owner" id="kendali"><div className="lp-wrap lp-owner-grid"><div><h2>AI menyiapkan pilihan.<br />Anda yang <span>menyetujui.</span></h2><p>Supplio dapat meminta penawaran dan melakukan paling banyak satu counter-offer per supplier. Sistem tidak memesan atau menjanjikan pembayaran atas nama Anda.</p></div><div className="lp-owner-rule"><ShieldCheck size={34} strokeWidth={1.5} aria-hidden="true" /><strong>Final Approval</strong><p>Hanya pemilik yang dapat menyetujui pembelian. Setelah persetujuan itu, purchase order dibuat dan dikirim.</p></div></div></section>;
}

function TrustAndQuestions() {
  return <section className="lp-section lp-trust" id="pertanyaan"><div className="lp-wrap lp-trust-grid"><div><h2>Prosesnya terbuka untuk ditinjau.</h2><p>Status penawaran, batas pembelian, dan alasan rekomendasi tampil sebelum keputusan akhir.</p><div className="lp-trust-points"><p><CircleCheck size={20} aria-hidden="true" /> Supplier tahu pesan berasal dari AI Supplio.</p><p><CircleCheck size={20} aria-hidden="true" /> Batas biaya diperiksa oleh sistem.</p><p><CircleCheck size={20} aria-hidden="true" /> Pembelian menunggu persetujuan pemilik.</p></div></div><div className="lp-faq"><h3>Pertanyaan umum</h3><details><summary>Apakah Supplio memesan otomatis?<ChevronDown size={20} aria-hidden="true" /></summary><p>Supplio otomatis memantau stok dan meminta penawaran saat dibutuhkan. Pembelian tetap menunggu Final Approval dari pemilik.</p></details><details><summary>Siapa yang membalas pesan Telegram?<ChevronDown size={20} aria-hidden="true" /></summary><p>Supplier manusia membalas bot Telegram Supplio. Bot menyatakan bahwa pesannya dibuat oleh AI, bukan dari akun pribadi Anda.</p></details><details><summary>Bagaimana jika penawaran tidak sesuai batas?<ChevronDown size={20} aria-hidden="true" /></summary><p>Supplio tidak memaksakan pembelian. Anda akan melihat alasan tidak adanya kombinasi yang memenuhi kebutuhan dan batas yang ditetapkan.</p></details></div></div></section>;
}

function Footer() {
  return <footer className="lp-footer"><div className="lp-wrap"><div className="lp-footer-top"><div><h2>Mulai kelola restock dengan keputusan yang jelas.</h2><p>Masuk untuk melihat stok, penawaran supplier, dan rekomendasi pembelian usaha Anda.</p></div><ActionLink /></div><div className="lp-footer-bottom"><a href="#beranda" aria-label="Supplio, kembali ke atas"><Image src="/brand/wordmark.svg" alt="Supplio" width={110} height={32} /></a><nav aria-label="Navigasi footer"><a href="#cara-kerja">Cara kerja</a><a href="#kemampuan">Kemampuan</a><a href="#kendali">Kendali Anda</a></nav><span>© Supplio</span></div></div></footer>;
}

export default function LandingExperience() {
  return <div className="supplio-landing-root"><a className="lp-skip" href="#konten">Lewati ke konten utama</a><Header /><main id="konten"><Hero /><Workflow /><Capabilities /><OwnerControl /><TrustAndQuestions /></main><Footer /></div>;
}
