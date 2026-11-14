import { formatQty, formatRupiah } from "@/lib/format";

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
  `Setuju menerima permintaan penawaran lewat chat ini? Setelah Anda setuju, ${p.businessName} akan mengonfirmasi koneksi ini lebih dulu.`;

export const CONSENT_BUTTON_TEXT = "Ya, saya setuju";

export const buildPendingMessage = (p: { businessName: string }) =>
  `Terima kasih, persetujuan Anda sudah kami terima. Koneksi ini menunggu konfirmasi dari ${p.businessName}. ` +
  `Anda belum akan menerima permintaan penawaran sampai dikonfirmasi; kami akan mengabari lewat chat ini.`;

export const buildRejectedMessage = (p: { businessName: string }) =>
  `Koneksi chat ini tidak dikonfirmasi oleh ${p.businessName}, jadi Anda tidak akan menerima permintaan penawaran. ` +
  `Bila ini keliru, mohon minta tautan undangan baru dari ${p.businessName}.`;

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

export interface OrderMessageItem {
  productName: string;
  quantity: string;
  unit: string;
  unitPrice: number;
  lineCost: number;
}

/**
 * Konfirmasi pemesanan resmi (SUPPLIO.md §4.3, §5). Dikirim HANYA setelah PO sah, yaitu setelah Final Approval pemilik.
 * Berisi nomor PO. Teks tetap (bukan LLM): angka berasal dari PO di database, dan Restock Budget tidak disertakan.
 */
export function buildOrderMessage(p: {
  businessName: string;
  supplierName: string;
  poNumber: string;
  items: OrderMessageItem[];
  shippingFee: number;
  totalCost: number;
  leadTimeDays: number | null;
}): string {
  const lines = p.items.map(
    (i) => `• ${i.productName}: ${formatQty(i.quantity)} ${i.unit} × ${formatRupiah(i.unitPrice)} = ${formatRupiah(i.lineCost)}`,
  );
  return (
    `PESANAN RESMI ${p.poNumber}\n\n` +
    `Halo ${p.supplierName}, pemilik ${p.businessName} telah menyetujui pembelian berikut ` +
    `(pesan ini dikirim oleh asisten AI Supplio atas persetujuan pemilik):\n${lines.join("\n")}\n\n` +
    `Ongkos kirim: ${formatRupiah(p.shippingFee)}\n` +
    `Total: ${formatRupiah(p.totalCost)}\n` +
    (p.leadTimeDays !== null ? `Estimasi tiba: ${p.leadTimeDays} hari sesuai penawaran Anda.\n` : "") +
    `\nMohon cantumkan nomor PO ${p.poNumber} pada pengiriman dan faktur.`
  );
}
