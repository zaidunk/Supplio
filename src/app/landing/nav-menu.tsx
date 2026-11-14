"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useEffect } from "react";

interface NavMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

const navItems = [
  { label: "Beranda", target: "beranda" },
  { label: "Tentang", target: "tentang" },
  { label: "Alur kerja", target: "alur-kerja" },
];

export function NavMenu({ isOpen, onClose, onNavigate }: NavMenuProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLinkClick = (target: string) => {
    onClose();
    onNavigate(target);
  };

  return (
    <div className="supplio-nav-overlay" role="dialog" aria-modal="true" aria-label="Menu navigasi">
      <div className="supplio-shell supplio-nav-overlay-inner">
        <div className="supplio-nav-top-bar">
          <div className="supplio-nav-brand">
            <Image src="/brand/icon.svg" alt="" width={32} height={32} />
            <span className="supplio-nav-title">Supplio</span>
          </div>
          <button type="button" className="supplio-nav-close-btn" onClick={onClose}>
            <X size={18} aria-hidden="true" />
            <span>Tutup</span>
          </button>
        </div>

        <nav aria-label="Menu navigasi">
          <ul className="supplio-nav-menu-list">
            {navItems.map((item) => (
              <li key={item.target}>
                <button
                  type="button"
                  className="supplio-nav-btn"
                  onClick={() => handleLinkClick(item.target)}
                >
                  {item.label}
                </button>
              </li>
            ))}
            <li>
              <Link href="/login" className="supplio-nav-btn supplio-nav-btn-highlight" onClick={onClose}>
                Masuk
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
