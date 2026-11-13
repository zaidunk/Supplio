import type { ProcurementStatus } from "@/generated/prisma/enums";
import type { EvaluateOutcome } from "@/lib/procurement/trigger";

export const STATUS_LABEL: Record<ProcurementStatus, string> = {
  CONFIGURATION_REQUIRED: "Perlu konfigurasi",
  DRAFT: "Draf",
  SOURCING: "Mencari penawaran",
  AWAITING_RESPONSES: "Menunggu balasan supplier",
  OPTIMIZING: "Menghitung kombinasi terbaik",
  AWAITING_APPROVAL: "Menunggu persetujuan",
  APPROVED: "Disetujui",
  ORDERED: "Dipesan",
  PARTIALLY_RECEIVED: "Diterima sebagian",
  COMPLETED: "Selesai",
  NO_FEASIBLE_SOLUTION: "Tidak ada solusi valid",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kedaluwarsa",
};

/** Pesan singkat untuk hasil evaluasi restock setelah mutasi stok / perubahan konfigurasi. */
export function describeTrigger(outcome: EvaluateOutcome): string | null {
  switch (outcome.outcome) {
    case "CREATED":
      return `Restock terdeteksi: procurement request dibuat otomatis untuk ${outcome.productIds.length} barang.`;
    case "DEFERRED":
      return "Ada kebutuhan restock baru, tetapi proses sourcing lain masih berjalan. Akan dievaluasi setelahnya.";
    case "CONFIGURATION_REQUIRED":
      return "Restock belum bisa diproses: konfigurasi belum lengkap (lihat status barang atau pengaturan budget).";
    case "EXISTING":
    case "NOT_NEEDED":
      return null;
  }
}
