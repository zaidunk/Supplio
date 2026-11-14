import type { RequestDetail } from "./queries";

/**
 * Opsi tindakan manual saat request berstatus NO_FEASIBLE_SOLUTION (SUPPLIO.md §9). Murni, tanpa DB.
 * Hanya MENJELASKAN apa yang perlu diubah pemilik pada request BARU; tidak melonggarkan constraint request ini
 * dan tidak memesan apa pun.
 */
export interface ManualHint {
  productName: string;
  unit: string;
  required: number;
  /** Total stok penawaran terkonfirmasi yang lead time-nya masih memenuhi batas kedatangan. */
  availableInTime: number;
  /** Batas kedatangan terkecil (hari) yang membuat stok penawaran cukup; null bila tidak ada yang bisa mencukupi. */
  suggestedMaxDeliveryDays: number | null;
  /** Kekurangan stok walau semua penawaran dipakai; 0 bila stok total cukup. */
  shortfall: number;
  messages: string[];
}

const qty = (n: number): string => String(Math.round(n * 1000) / 1000);

type Item = RequestDetail["items"][number];
type Session = RequestDetail["sessions"][number];

interface Offer {
  supplierName: string;
  leadTimeDays: number | null;
  available: number;
}

/** Penawaran CONFIRMED terbaru per supplier untuk satu produk (sama seperti yang dibaca solver). */
function offersFor(productName: string, sessions: Session[]): Offer[] {
  const offers: Offer[] = [];
  for (const s of sessions) {
    const confirmed = s.quotations.filter((q) => q.status === "CONFIRMED");
    const latest = confirmed[confirmed.length - 1];
    const item = latest?.items.find((i) => i.productName === productName);
    if (!latest || !item) continue;
    offers.push({
      supplierName: s.supplierName,
      leadTimeDays: latest.leadTimeDays,
      // Stok tidak disebutkan = tidak membatasi (selaras dengan penawaran tanpa batas stok).
      available: item.availableQuantity === null ? Number.POSITIVE_INFINITY : Number(item.availableQuantity),
    });
  }
  return offers;
}

export function buildManualHints(items: Item[], sessions: Session[]): ManualHint[] {
  return items.map((item) => {
    const required = Number(item.requiredQuantity);
    const offers = offersFor(item.productName, sessions);
    const inTime = offers.filter((o) => o.leadTimeDays === null || o.leadTimeDays <= item.maxDeliveryDays);
    const sum = (list: Offer[]) => list.reduce((acc, o) => acc + o.available, 0);
    const availableInTime = sum(inTime);
    const total = sum(offers);
    const messages: string[] = [];
    let suggestedMaxDeliveryDays: number | null = null;

    if (offers.length === 0) {
      messages.push("Belum ada penawaran terkonfirmasi untuk barang ini. Hubungkan atau aktifkan supplier yang menyuplainya.");
    } else if (availableInTime >= required) {
      messages.push("Stok penawaran yang tepat waktu sudah cukup; penyebabnya kemungkinan kombinasi harga, ongkir, atau Restock Budget.");
    } else {
      // Naikkan batas kedatangan sampai stok terkumpul cukup, mulai dari lead time tercepat.
      const byLead = [...offers].sort((a, b) => (a.leadTimeDays ?? 0) - (b.leadTimeDays ?? 0));
      let running = 0;
      for (const o of byLead) {
        running += o.available;
        if (running >= required) {
          suggestedMaxDeliveryDays = o.leadTimeDays ?? item.maxDeliveryDays;
          break;
        }
      }
      if (suggestedMaxDeliveryDays !== null && suggestedMaxDeliveryDays > item.maxDeliveryDays) {
        const late = byLead.filter((o) => o.leadTimeDays !== null && o.leadTimeDays > item.maxDeliveryDays);
        messages.push(
          `Stok tepat waktu hanya ${qty(availableInTime)} ${item.unit} dari ${qty(required)} ${item.unit}. Kebutuhan tercukupi bila batas kedatangan dinaikkan menjadi ${suggestedMaxDeliveryDays} hari (${late.map((o) => `${o.supplierName}: ${o.leadTimeDays} hari`).join(", ")}).`,
        );
      } else {
        messages.push(
          `Total stok semua penawaran ${qty(total)} ${item.unit}, dibutuhkan ${qty(required)} ${item.unit} (kurang ${qty(required - total)} ${item.unit}). Tambah supplier atau kurangi jumlah kebutuhan.`,
        );
      }
    }

    return {
      productName: item.productName,
      unit: item.unit,
      required,
      availableInTime: Number.isFinite(availableInTime) ? availableInTime : required,
      suggestedMaxDeliveryDays,
      shortfall: Number.isFinite(total) ? Math.max(0, required - total) : 0,
      messages,
    };
  });
}
