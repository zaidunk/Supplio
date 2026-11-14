import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="supplio-footer">
      <div className="supplio-shell supplio-footer-inner">
        <div className="supplio-footer-cta-row">
          <h2 className="supplio-footer-cta-title">Siap mengelola restock dengan lebih tenang?</h2>
          <Link href="/login" className="supplio-pill-btn supplio-pill-btn-light">
            <span>Masuk ke Supplio</span>
            <span className="supplio-pill-badge" aria-hidden="true">
              <ArrowUpRight size={15} />
            </span>
          </Link>
        </div>

        <div className="supplio-footer-columns">
          <div className="supplio-col-brand">
            <div className="supplio-footer-logo-wrap">
              <Image
                src="/brand/wordmark.svg"
                alt="Supplio"
                width={102}
                height={30}
                className="supplio-footer-wordmark"
              />
            </div>
            <p className="supplio-footer-tagline">
              Membantu UMKM memantau stok dan mengelola penawaran supplier. Keputusan pembelian tetap di tangan Anda.
            </p>
          </div>

          <nav aria-label="Navigasi footer">
            <ul className="supplio-col-links">
              <li><a href="#tentang" className="supplio-footer-link">Tentang</a></li>
              <li><a href="#alur-kerja" className="supplio-footer-link">Alur kerja</a></li>
            </ul>
          </nav>
        </div>

        <div className="supplio-footer-legal-bar">
          <span>© Supplio</span>
          <span>Untuk UMKM Indonesia</span>
        </div>
      </div>
    </footer>
  );
}
