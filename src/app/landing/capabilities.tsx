"use client";

import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

const capabilitiesData = [
  {
    category: "INVENTORY — PERSEDIAAN",
    title: "Deteksi Restock Otomatis",
    description:
      "Perhitungan deterministik Inventory Position, Reorder Point, dan Target Stock menggabungkan konsumsi harian, lead time, dan safety stock tanpa menunggu stok habis.",
    tags: ["Current Stock", "Safety Stock", "Reorder Point"],
  },
  {
    category: "MESSAGING — TELEGRAM BOT API",
    title: "Negosiasi via Bot Telegram",
    description:
      "AI menghubungi supplier manusia atas nama UMKM, menanyakan harga, MOQ, ongkir, dan ketersediaan. Dibatasi maksimal 1 putaran counter-offer dengan identitas AI yang jujur.",
    tags: ["Telegram Bot", "Single Counter-Offer", "Zod Extraction"],
  },
  {
    category: "OPTIMIZER — DETERMINISTIK",
    title: "Optimasi Biaya Terendah (MILP)",
    description:
      "Mixed-Integer Linear Programming mencari kombinasi supplier dengan total harga item + ongkir terendah yang memenuhi kuantitas dan tidak melampaui Restock Budget.",
    tags: ["MILP Solver", "Restock Budget", "Biaya Ongkir"],
  },
  {
    category: "GOVERNANCE — HUMAN-IN-THE-LOOP",
    title: "Final Approval & Purchase Order",
    description:
      "AI tidak pernah membuat komitmen pembayaran atau persetujuan sepihak. Pemilik meninjau detail penawaran, lalu menerbitkan Purchase Order resmi dengan satu klik.",
    tags: ["Human-in-the-Loop", "PO Otomatis", "Audit Transparan"],
  },
];

export function Capabilities() {
  return (
    <section className="supplio-capabilities-section" id="kemampuan">
      <div className="supplio-shell">
        {/* Section Heading */}
        <h2 className="supplio-section-h2-center">
          Teknologi Nyata, Bukan Janji Hype
        </h2>

        {/* 4 Cards Grid */}
        <div className="supplio-capabilities-grid">
          {capabilitiesData.map((item) => (
            <article
              key={item.title}
              className="supplio-capability-card supplio-card-enter"
            >
              {/* Top Meta Row */}
              <div className="supplio-card-top-meta">
                <span className="supplio-card-category">{item.category}</span>
                <span className="supplio-card-badge-arrow">
                  <ArrowUpRight size={18} />
                </span>
              </div>

              {/* Watermark in Card Center */}
              <div className="supplio-card-watermark" aria-hidden="true">
                <Image
                  src="/brand/icon.svg"
                  alt=""
                  width={90}
                  height={86}
                  className="supplio-card-watermark-img"
                />
              </div>

              {/* Bottom Content */}
              <div className="supplio-card-bottom">
                <h3 className="supplio-card-title">{item.title}</h3>
                <p className="supplio-card-desc">{item.description}</p>
                <div className="supplio-card-tags">
                  {item.tags.map((tag) => (
                    <span key={tag} className="supplio-tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
