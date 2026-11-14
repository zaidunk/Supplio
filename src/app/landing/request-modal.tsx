"use client";

import { Check, X, ArrowUpRight, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RequestModal({ isOpen, onClose }: RequestModalProps) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [businessType, setBusinessType] = useState("F&B / Kedai Kopi");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setIsSuccess(false);
      setName("");
      setContact("");
      setNotes("");
    }, 300);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !contact) return;

    setIsSubmitting(true);
    // Stubbed submit
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div
      className="supplio-modal-backdrop"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Formulir simulasi pengadaan Supplio"
    >
      <div
        className="supplio-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button Top Right */}
        <button
          type="button"
          className="supplio-modal-close"
          onClick={handleClose}
          aria-label="Tutup jendela simulasi"
        >
          <X size={18} />
        </button>

        {!isSuccess ? (
          <>
            {/* Form Header */}
            <div className="supplio-modal-header">
              <h2 className="supplio-modal-title">
                Uji Alur Pengadaan Bisnis Anda
              </h2>
              <p className="supplio-modal-subtitle">
                Isi rincian sederhana di bawah untuk mencoba simulasi bot Telegram
                dan optimasi biaya untuk usaha Anda.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="supplio-modal-form">
              <div className="supplio-form-group">
                <label htmlFor="owner-name" className="supplio-form-label">
                  Nama Pemilik / Manajer
                </label>
                <input
                  id="owner-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="supplio-form-input"
                />
              </div>

              <div className="supplio-form-group">
                <label htmlFor="owner-contact" className="supplio-form-label">
                  Nomor WhatsApp / Telegram
                </label>
                <input
                  id="owner-contact"
                  type="text"
                  required
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Contoh: 0812-3456-7890"
                  className="supplio-form-input"
                />
              </div>

              <div className="supplio-form-group">
                <label htmlFor="business-type" className="supplio-form-label">
                  Kategori Usaha
                </label>
                <select
                  id="business-type"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="supplio-form-select"
                >
                  <option value="F&B / Kedai Kopi">F&B / Kedai Kopi / Resto</option>
                  <option value="Toko Ritel & Grosir">Toko Ritel & Bahan Baku</option>
                  <option value="Bakery & Pastry">Bakery & Pastry</option>
                  <option value="Manufaktur Skala Kecil">Manufaktur UMKM</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className="supplio-form-group">
                <label htmlFor="procure-notes" className="supplio-form-label">
                  Kebutuhan Restock Utama
                </label>
                <textarea
                  id="procure-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Biji kopi 20kg/minggu, susu segar 50 liter, kemasan cup..."
                  className="supplio-form-textarea"
                />
              </div>

              <div className="supplio-modal-footer">
                <span className="supplio-modal-disclaimer">
                  Data simulasi · Respon dalam 1 hari kerja
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="supplio-pill-btn supplio-pill-btn-dark supplio-pill-btn-sm"
                >
                  <span>{isSubmitting ? "Mengirim..." : "Kirim Permintaan"}</span>
                  <span className="supplio-pill-badge">
                    {isSubmitting ? <Send size={14} /> : <ArrowUpRight size={14} />}
                  </span>
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Success Screen */
          <div className="supplio-modal-success">
            <div className="supplio-success-badge">
              <Check size={28} className="text-pink-500" />
            </div>
            <h2 className="supplio-success-title">Permintaan Diterima</h2>
            <p className="supplio-success-desc">
              Terima kasih, <strong>{name}</strong>! Kami akan menyiapkan
              skenario simulasi pengadaan untuk usaha {businessType} Anda dan
              menghubungi via {contact}.
            </p>
            <button
              type="button"
              className="supplio-pill-btn supplio-pill-btn-dark"
              onClick={handleClose}
            >
              <span>Tutup Jendela</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
