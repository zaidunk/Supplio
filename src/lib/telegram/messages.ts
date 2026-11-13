import { formatQty } from "@/lib/format";

/**
 * Teks pesan tetap (bukan LLM). Aturan SUPPLIO.md §1 dan §5 yang ditegakkan di sini:
 *  - identitas pengirim = asisten AI Supplio, tidak menyamar sebagai manusia;
 *  - ini PERMINTAAN penawaran, bukan pesanan, dan tidak ada janji pembayaran;
 *  - Restock Budget internal TIDAK PERNAH disertakan.
 * Dikirim sebagai teks polos (tanpa parse_mode) sehingga nama bisnis/produk tidak bisa menyuntikkan markup.
 */
export const WELCOME_REPLY =
  "Halo, saya asisten AI Supplio (program komputer, bukan manusia). Untuk terhubung, buka tautan undangan yang dikirim oleh UMKM pemesan.";

export const INVALID_LINK_REPLY =
  "Tautan undangan ini tidak valid, sudah dipakai, atau sudah kedaluwarsa. Mohon minta tautan baru dari UMKM pemesan.";

export const NO_ACTIVE_REQUEST_REPLY =
  "Saat ini tidak ada permintaan penawaran yang aktif untuk Anda. Pesan Anda sudah dicatat dan tidak akan memulai pesanan. Terima kasih.";

export const buildConsentMessage = (p: { businessName: string; supplierName: string }) =>
  `Halo ${p.supplierName}! Saya asisten AI Supplio (program komputer, bukan manusia) yang bekerja atas nama ${p.businessName}.\n\n` +
  `Lewat chat ini saya akan meminta penawaran harga, stok, minimum order, ongkir, dan lead time. ` +
  `Saya tidak dapat memesan atau menjanjikan pembayaran; keputusan pembelian akhir ada pada pemilik ${p.businessName}.\n\n` +
  `Setuju menerima permintaan penawaran lewat chat ini?`;

export const CONSENT_BUTTON_TEXT = "Ya, saya setuju";

export const buildConnectedMessage = (p: { businessName: string }) =>
  `Terima kasih, koneksi berhasil. Anda akan menerima permintaan penawaran dari ${p.businessName} lewat chat ini. ` +
  `Anda dapat berhenti kapan saja dengan menghentikan/memblokir bot ini.`;

export interface OutreachItem {
  productName: string;
  quantity: string;
  unit: string;
  maxDeliveryDays: number;
}

export function buildOutreachMessage(p: { businessName: string; supplierName: string; items: OutreachItem[] }): string {
  const lines = p.items.map(
    (i) => `• ${i.productName}: ${formatQty(i.quantity)} ${i.unit}, tiba maksimal ${i.maxDeliveryDays} hari`,
  );
  return (
    `Halo ${p.supplierName}, saya asisten AI Supplio (program komputer, bukan manusia) yang mengirim pesan atas nama ${p.businessName}.\n\n` +
    `Kami meminta penawaran untuk:\n${lines.join("\n")}\n\n` +
    `Mohon balas dengan: harga per satuan, stok tersedia, minimum order (MOQ), ongkos kirim, dan estimasi lead time.\n\n` +
    `Catatan: ini hanya permintaan penawaran, bukan pemesanan. Pesanan baru sah setelah pemilik menyetujui dan nomor PO dikirim.`
  );
}
