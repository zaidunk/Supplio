"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="supplio-hero" id="beranda">
      <div className="supplio-shell supplio-hero-grid">
        <div className="supplio-hero-left">
          <h1 className="supplio-hero-title">
            Restock tanpa<br />
            chat supplier.
          </h1>
          <p className="supplio-hero-desc">
            Supplio memantau stok dan mengurus penawaran supplier. Anda meninjau biaya sebelum menyetujui pembelian.
          </p>
          <div className="supplio-hero-ctas">
            <Link href="/login" className="supplio-pill-btn supplio-pill-btn-accent">
              <span>Masuk ke Supplio</span>
              <span className="supplio-pill-badge" aria-hidden="true">
                <ArrowRight size={16} />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
