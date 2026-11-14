"use client";

import { useEffect, useRef, useState } from "react";

const statsConfig = [
  { target: 100, suffix: "%", label: "Kendali di tangan pemilik (Final Approval)" },
  { target: 1, suffix: "", label: "Maksimal counter-offer per supplier (Anti-spam)" },
  { target: 0, suffix: "", label: "Komitmen transaksi sepihak oleh AI (Zero Risk)" },
  { target: 24, suffix: "/7", label: "Pemantauan stok dan kebutuhan restock" },
];

export function StatsPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const [counts, setCounts] = useState<number[]>([0, 0, 0, 0]);
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (hasTriggered) return;
      const rect = el.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // start: top hits bottom, end: center hits center
      if (rect.top <= windowHeight) {
        setHasTriggered(true);

        const duration = 1200;
        const startTime = performance.now();

        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(1, elapsed / duration);
          const easeOutQuart = 1 - Math.pow(1 - progress, 4);

          setCounts(
            statsConfig.map((stat) => Math.round(stat.target * easeOutQuart))
          );

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            setCounts(statsConfig.map((s) => s.target));
          }
        };

        requestAnimationFrame(animate);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check once on mount

    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasTriggered]);

  return (
    <section className="supplio-stats-section" id="prinsip">
      <div className="supplio-shell">
        <div className="supplio-stats-panel" ref={panelRef}>
          {/* Heading */}
          <h2 className="supplio-stats-h2">
            Ketegasan aturan dalam setiap transaksi.
          </h2>

          {/* Stats Grid */}
          <div className="supplio-stats-grid">
            {statsConfig.map((stat, i) => (
              <div key={stat.label} className="supplio-stat-item">
                <div className="supplio-stat-number tabular">
                  <span>{counts[i]}</span>
                  <span className="supplio-stat-suffix">{stat.suffix}</span>
                </div>
                <p className="supplio-stat-label">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
