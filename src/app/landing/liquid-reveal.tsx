"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Check, AlertCircle, ArrowUpRight, MessageSquare } from "lucide-react";

export function LiquidRevealShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"brush" | "supplio" | "manual">("brush");

  useEffect(() => {
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced || mode !== "brush") return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    const brushRadius = 130;
    const decay = 0.016;
    let idle = 0;
    let animId: number;
    let points: { x: number; y: number }[] = [];
    let lastPoint: { x: number; y: number } | null = null;

    // Create offscreen brush canvas
    const brushCanvas = document.createElement("canvas");
    const brushCtx = brushCanvas.getContext("2d");

    // Create offscreen cover canvas for the "manual chaos" layer
    const coverCanvas = document.createElement("canvas");
    const coverCtx = coverCanvas.getContext("2d");

    const resize = () => {
      const rect = container.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      coverCanvas.width = width * dpr;
      coverCanvas.height = height * dpr;

      const r = brushRadius * dpr;
      const diam = Math.ceil(r * 2);
      brushCanvas.width = diam;
      brushCanvas.height = diam;

      // Draw manual chaos visual into cover canvas
      if (coverCtx) {
        coverCtx.save();
        coverCtx.scale(dpr, dpr);
        // Background for manual chaos
        coverCtx.fillStyle = "#1c2333";
        coverCtx.fillRect(0, 0, width, height);

        // Subtle grid
        coverCtx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        coverCtx.lineWidth = 1;
        for (let x = 0; x < width; x += 30) {
          coverCtx.beginPath();
          coverCtx.moveTo(x, 0);
          coverCtx.lineTo(x, height);
          coverCtx.stroke();
        }
        for (let y = 0; y < height; y += 30) {
          coverCtx.beginPath();
          coverCtx.moveTo(0, y);
          coverCtx.lineTo(width, y);
          coverCtx.stroke();
        }

        // WhatsApp-like chat bubbles simulation
        coverCtx.fillStyle = "#273349";
        coverCtx.beginPath();
        coverCtx.roundRect(24, 30, Math.min(width - 48, 380), 65, 12);
        coverCtx.fill();

        coverCtx.fillStyle = "#fc90cb";
        coverCtx.font = "500 11px sans-serif";
        coverCtx.fillText("CHAT MANUAL (TERCECER)", 40, 52);

        coverCtx.fillStyle = "#ffffff";
        coverCtx.font = "13px sans-serif";
        coverCtx.fillText('"Pak, kopi house blend ready 12kg? Harga berapa?"', 40, 75);

        // Supplier reply bubble
        coverCtx.fillStyle = "#1e293b";
        coverCtx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        coverCtx.lineWidth = 1;
        coverCtx.beginPath();
        coverCtx.roundRect(40, 110, Math.min(width - 80, 420), 80, 12);
        coverCtx.fill();
        coverCtx.stroke();

        coverCtx.fillStyle = "#f87171";
        coverCtx.font = "500 11px sans-serif";
        coverCtx.fillText("BALASAN MANUAL TERLAMBAT (2 HARI KEMUDIAN)", 56, 132);

        coverCtx.fillStyle = "#e2e8f0";
        coverCtx.font = "13px sans-serif";
        coverCtx.fillText('"Maaf baru balas mas, harga naik jadi Rp 135.000/kg"', 56, 153);
        coverCtx.fillText('"Belum termasuk ongkir ya, nanti saya carikan ekspedisi."', 56, 172);

        // Cluttered calculation post-it
        coverCtx.fillStyle = "#fef08a";
        coverCtx.save();
        coverCtx.translate(width - 180, height - 160);
        coverCtx.rotate((3 * Math.PI) / 180);
        coverCtx.beginPath();
        coverCtx.roundRect(0, 0, 150, 130, 8);
        coverCtx.fill();

        coverCtx.fillStyle = "#854d0e";
        coverCtx.font = "500 11px sans-serif";
        coverCtx.fillText("HITUNG MANUAL ⚠️", 14, 26);
        coverCtx.fillStyle = "#1c1917";
        coverCtx.font = "12px monospace";
        coverCtx.fillText("12 x 135rb", 14, 48);
        coverCtx.fillText("= 1.620.000", 14, 66);
        coverCtx.fillText("+ Ongkir ??", 14, 84);
        coverCtx.fillStyle = "#dc2626";
        coverCtx.font = "500 11px sans-serif";
        coverCtx.fillText("OVER BUDGET!", 14, 110);
        coverCtx.restore();

        coverCtx.restore();
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * dpr;
      const y = (e.clientY - rect.top) * dpr;
      const r = brushRadius * dpr;

      if (x < -r || x > canvas.width + r || y < -r || y > canvas.height + r) {
        lastPoint = null;
        return;
      }

      if (!lastPoint) {
        lastPoint = { x, y };
        points.push({ x, y });
        return;
      }

      const dx = x - lastPoint.x;
      const dy = y - lastPoint.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(r * 0.3, 1);
      const count = Math.min(Math.ceil(dist / step), 60);

      for (let i = 1; i <= count; i++) {
        const t = i / count;
        points.push({
          x: lastPoint.x + dx * t,
          y: lastPoint.y + dy * t,
        });
      }

      lastPoint = { x, y };
    };

    window.addEventListener("pointermove", onPointerMove);

    const tick = () => {
      animId = requestAnimationFrame(tick);
      if (!ctx || !brushCtx) return;

      const drawing = points.length > 0;
      if (drawing) {
        idle = 0;
      } else {
        idle++;
        if (idle > 120) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          return;
        }
      }

      // Decay trail
      const fade = drawing ? decay : Math.min(decay + idle * 0.004, 0.5);
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (drawing) {
        const r = brushRadius * dpr;
        const diam = Math.ceil(r * 2);
        const c = diam / 2;

        for (const p of points) {
          brushCtx.clearRect(0, 0, diam, diam);
          brushCtx.globalCompositeOperation = "source-over";

          // Radial stamp gradient
          const grad = brushCtx.createRadialGradient(c, c, 0, c, c, r);
          grad.addColorStop(0, "rgba(255, 255, 255, 1)");
          grad.addColorStop(0.55, "rgba(255, 255, 255, 0.82)");
          grad.addColorStop(1, "rgba(255, 255, 255, 0)");

          brushCtx.fillStyle = grad;
          brushCtx.fillRect(0, 0, diam, diam);

          // source-in: copy slice from coverCanvas
          brushCtx.globalCompositeOperation = "source-in";
          brushCtx.drawImage(
            coverCanvas,
            p.x - c,
            p.y - c,
            diam,
            diam,
            0,
            0,
            diam,
            diam
          );

          // Draw stamp onto main canvas
          ctx.globalCompositeOperation = "source-over";
          ctx.drawImage(brushCanvas, p.x - c, p.y - c);
        }
        points = [];
      }
    };

    tick();

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      ro.disconnect();
      cancelAnimationFrame(animId);
    };
  }, [mode]);

  return (
    <div className="supplio-showcase-wrapper">
      {/* Interactive Mode Bar */}
      <div className="supplio-showcase-mode-bar">
        <div className="supplio-mode-buttons" role="tablist" aria-label="Mode tampilan alur">
          <button
            type="button"
            className={`supplio-mode-btn ${mode === "brush" ? "supplio-mode-btn-active" : ""}`}
            onClick={() => setMode("brush")}
            title="Gerakkan kursor untuk menggosok dan membandingkan"
          >
            Liquid Reveal
          </button>
          <button
            type="button"
            className={`supplio-mode-btn ${mode === "supplio" ? "supplio-mode-btn-active" : ""}`}
            onClick={() => setMode("supplio")}
          >
            Supplio
          </button>
          <button
            type="button"
            className={`supplio-mode-btn ${mode === "manual" ? "supplio-mode-btn-active" : ""}`}
            onClick={() => setMode("manual")}
          >
            Manual (Sebelum)
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div
        ref={containerRef}
        className="supplio-showcase-box"
      >
        {/* BASE LAYER: Supplio AI Procurement (Always Clean & Organized) */}
        <div className="supplio-clean-layer">
          {/* Card Top: Procurement Request Header */}
          <div className="supplio-preview-header">
            <div className="supplio-preview-id">
              <span className="supplio-mark-box">
                <Image src="/brand/icon.svg" alt="" width={24} height={23} />
              </span>
              <div>
                <strong>Procurement #PR-104</strong>
                <small className="tabular">Restock Periode 14 Nov 2026</small>
              </div>
            </div>
            <div className="supplio-status-pill supplio-status-awaiting">
              <span className="supplio-dot-pulse" />
              <span>Menunggu Final Approval</span>
            </div>
          </div>

          {/* Budget Snapshot Banner */}
          <div className="supplio-budget-banner">
            <div className="supplio-budget-col">
              <span className="supplio-metric-lbl">Restock Budget</span>
              <span className="supplio-metric-val tabular">Rp 5.000.000</span>
            </div>
            <div className="supplio-budget-divider" />
            <div className="supplio-budget-col">
              <span className="supplio-metric-lbl">Total Sourcing + Ongkir</span>
              <span className="supplio-metric-val supplio-metric-highlight tabular">
                Rp 4.350.000
              </span>
            </div>
            <div className="supplio-budget-divider" />
            <div className="supplio-budget-col">
              <span className="supplio-metric-lbl">Sisa Anggaran</span>
              <span className="supplio-metric-val supplio-metric-success tabular">
                +Rp 650.000
              </span>
            </div>
          </div>

          {/* Sourcing Breakdown Cards */}
          <div className="supplio-items-list">
            {/* Item 1 */}
            <div className="supplio-item-row">
              <div className="supplio-item-meta">
                <span className="supplio-item-badge">01</span>
                <div>
                  <strong>Kopi House Blend (Arabika-Robusta)</strong>
                  <small>Supplier: Toko Bahan Berkah · Dikonfirmasi via Telegram</small>
                </div>
              </div>
              <div className="supplio-item-stats">
                <span className="supplio-item-qty tabular">12 kg</span>
                <span className="supplio-item-price tabular">@ Rp 120.000</span>
                <span className="supplio-item-shipping tabular">Ongkir Rp 25.000</span>
              </div>
            </div>

            {/* Item 2 */}
            <div className="supplio-item-row">
              <div className="supplio-item-meta">
                <span className="supplio-item-badge">02</span>
                <div>
                  <strong>Susu Segar UHT Full Cream</strong>
                  <small>Supplier: CV Pangan Mandiri · Dikonfirmasi via Telegram</small>
                </div>
              </div>
              <div className="supplio-item-stats">
                <span className="supplio-item-qty tabular">24 liter</span>
                <span className="supplio-item-price tabular">@ Rp 18.000</span>
                <span className="supplio-item-shipping tabular">Ongkir Rp 30.000</span>
              </div>
            </div>
          </div>

          {/* Bottom Card Footer */}
          <div className="supplio-preview-footer">
            <div className="supplio-explainer-text">
              <Check size={14} className="text-emerald-600" />
              <span>
                <strong>Optimasi MILP:</strong> Kombinasi harga terendah memenuhi kebutuhan operasional.
              </span>
            </div>
            <div className="supplio-action-btn">
              <span>Setujui Pembelian (2 PO)</span>
              <ArrowUpRight size={14} />
            </div>
          </div>
        </div>

        {/* BRUSH CANVAS OVERLAY (When mode === 'brush') */}
        {mode === "brush" && (
          <canvas
            ref={canvasRef}
            className="supplio-brush-canvas"
            aria-hidden="true"
          />
        )}

        {/* MANUAL OVERLAY (When mode === 'manual') */}
        {mode === "manual" && (
          <div className="supplio-manual-layer">
            <div className="supplio-manual-content">
              <div className="supplio-manual-badge">
                <AlertCircle size={14} className="text-red-400" />
                <span>Pengadaan Manual Tanpa Supplio</span>
              </div>
              <div className="supplio-chat-mock">
                <div className="supplio-chat-bubble supplio-chat-outgoing">
                  <p>Pak, kopi house blend ready 12kg? Harga berapa sekarang?</p>
                  <span>10:14</span>
                </div>
                <div className="supplio-chat-bubble supplio-chat-incoming">
                  <p>Maaf baru balas mas, harga naik jadi Rp 135.000/kg. Ongkir belum tau ya.</p>
                  <span>16:42 (6 jam kemudian)</span>
                </div>
              </div>
              <div className="supplio-manual-notes">
                <div className="supplio-note-tag">Perhitungan Berantakan</div>
                <p>12 kg × Rp 135.000 = Rp 1.620.000. Belum ongkir, resiko over budget dan stok habis saat jam sibuk.</p>
              </div>
            </div>
          </div>
        )}

        {/* Hint Pill */}
        {mode === "brush" && (
          <div className="supplio-brush-hint" aria-hidden="true">
            <MessageSquare size={13} />
            <span>Gerakkan kursor di atas kartu untuk membandingkan alur chat manual</span>
          </div>
        )}
      </div>
    </div>
  );
}
