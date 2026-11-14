"use client";

import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { cn } from "@/lib/utils";

/**
 * Placeholder loading (react-loading-skeleton) yang meniru struktur halaman dashboard:
 * judul, kartu ringkasan, kartu berisi tabel/teks. Sengaja sederhana agar tidak mengganggu.
 */

/** Pembungkus: tema warna dan semantik "sedang memuat" untuk pembaca layar. */
export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <SkeletonTheme baseColor="#ebe8f0" highlightColor="#f6f4f9" borderRadius={8}>
      <div role="status" aria-busy="true" aria-label="Memuat halaman" className="flex flex-col gap-6">
        {children}
      </div>
    </SkeletonTheme>
  );
}

export function HeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <Skeleton width={200} height={36} />
      {withAction ? <Skeleton width={140} height={36} /> : null}
    </div>
  );
}

/** Deretan kartu angka; `className` menentukan kolom grid (sama dengan halaman aslinya). */
export function StatCardsSkeleton({
  count = 4,
  className = "grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-xl border border-line bg-card p-5">
          <Skeleton width="60%" height={20} />
          <Skeleton width={56} height={32} />
        </div>
      ))}
    </div>
  );
}

/** Kartu dengan judul dan baris tabel. */
export function TableCardSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-xl border border-line bg-card p-6", className)}>
      <Skeleton width={160} height={24} />
      <Skeleton height={20} />
      <Skeleton count={rows} height={36} className="mb-1" />
    </div>
  );
}

/** Kartu dengan judul dan beberapa baris teks/form. */
export function TextCardSkeleton({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-xl border border-line bg-card p-6", className)}>
      <Skeleton width={160} height={24} />
      <Skeleton count={lines} height={40} className="mb-2" />
    </div>
  );
}
