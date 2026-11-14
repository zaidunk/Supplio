import type { MascotSection } from "@/components/mascot/mascot-guide";

/** Titik singgah Supplio di landing page: pinggir kiri atau kanan, bergantian, di dekat bagian yang sedang dilihat. */
export const LANDING_MASCOT_SECTIONS: MascotSection[] = [
  {
    selector: "#beranda",
    at: { x: 0.93, y: 0.85 },
    lines: ["Stok menipis? Itu bagianku mengintip.", "Restock UMKM, keputusan tetap di tanganmu."],
  },
  {
    selector: "#cara-kerja",
    at: { x: 0.07, y: 0.45 },
    lines: [
      "Empat langkah: stok menipis, supplier menawar, pilihan dihitung, kamu yang memutuskan.",
      "Yang menghubungi supplier lewat Telegram itu bot, jadi kamu tidak perlu bolak-balik chat.",
    ],
  },
  {
    selector: "#kemampuan",
    at: { x: 0.93, y: 0.45 },
    lines: [
      "Penawaran, harga barang, ongkir: semuanya dibandingkan dalam satu alur.",
      "Aku suka bagian ini. Banyak angka, tapi rapi.",
      "Alasan di balik tiap pilihan juga ditampilkan.",
    ],
  },
  {
    selector: "#kendali",
    at: { x: 0.07, y: 0.5 },
    lines: [
      "Purchase order baru dibuat setelah kamu menekan Final Approval.",
      "Kamu yang pegang kendali. Aku cuma kotak yang membantu.",
      "Tidak ada pembelian diam-diam di sini.",
    ],
  },
  {
    selector: "#pertanyaan",
    at: { x: 0.93, y: 0.4 },
    lines: [
      "Penasaran sesuatu? Jawabannya ada di daftar ini.",
      "Prosesnya terbuka untuk ditinjau, lho.",
      "Masih ragu? Buka satu pertanyaannya.",
    ],
  },
  {
    selector: ".lp-footer",
    at: { x: 0.9, y: 0.6 },
    lines: ["Sudah sampai bawah! Siap mencoba Supplio?", "Tombol masuk menunggu di sini.", "Terima kasih sudah ikut keliling."],
  },
];
