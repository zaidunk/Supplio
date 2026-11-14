"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Menu as MenuIcon } from "lucide-react";

interface HeaderProps {
  onOpenMenu: () => void;
  onNavigate: (id: string) => void;
}

export function Header({
  onOpenMenu,
  onNavigate,
}: HeaderProps) {
  return (
    <header className="supplio-header">
      <div className="supplio-shell supplio-header-inner">
        {/* Left: Brand */}
        <button
          type="button"
          className="supplio-brand-btn"
          onClick={() => onNavigate("beranda")}
          aria-label="Supplio, kembali ke atas"
        >
          <Image
            src="/brand/wordmark.svg"
            alt="Supplio"
            width={96}
            height={28}
            priority
            className="supplio-brand-logo"
          />
        </button>

        {/* Center: Nav links */}
        <nav className="supplio-primary-nav" aria-label="Navigasi utama">
          <ul className="supplio-nav-list">
            <li>
              <button
                type="button"
                className="supplio-nav-link"
                onClick={() => onNavigate("beranda")}
              >
                Beranda
              </button>
            </li>
            <li>
              <button
                type="button"
                className="supplio-nav-link"
                onClick={() => onNavigate("tentang")}
              >
                Tentang
              </button>
            </li>
            <li>
              <button
                type="button"
                className="supplio-nav-link"
                onClick={() => onNavigate("alur-kerja")}
              >
                Alur Kerja
              </button>
            </li>
          </ul>
        </nav>

        {/* One primary action */}
        <div className="supplio-header-actions">
          {/* Login CTA */}
          <Link
            href="/login"
            className="supplio-pill-btn supplio-pill-btn-accent supplio-pill-btn-sm"
          >
            <span>Masuk</span>
            <span className="supplio-pill-badge">
              <ArrowUpRight size={14} />
            </span>
          </Link>

          {/* Mobile / Quick Menu Button */}
          <button
            type="button"
            className="supplio-menu-btn"
            onClick={onOpenMenu}
            aria-label="Buka menu navigasi"
          >
            <MenuIcon size={16} strokeWidth={2} />
            <span className="supplio-menu-text">Menu</span>
          </button>
        </div>
      </div>
    </header>
  );
}
