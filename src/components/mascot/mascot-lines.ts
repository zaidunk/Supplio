/** Kalimat Supplio, si kotak paket yang ramah dan suka bercanda. Dipilih acak, tanpa mengulang kalimat yang sama berturut-turut. */

export const FIRST_VISIT = [
  "Halo, aku Supplio! Kotak paket yang hobi mengurus restock.",
  "Hai! Namaku Supplio, sama seperti aplikasinya. Yuk, kuajak keliling.",
  "Selamat datang! Scroll saja, nanti kuikuti dari samping.",
];

export const RETURNING = [
  "Wah, ketemu lagi. Isi kotakku sudah kurapikan.",
  "Halo lagi! Tadi aku sempat mengelap pita.",
  "Supplio siap lagi. Mau lihat bagian mana dulu?",
  "Kamu datang pas aku selesai menyusun kardus.",
];

export const PAT = [
  "Hehe, geli di bagian pita.",
  "Pelan-pelan, nanti penyok.",
  "Elusan terbaik hari ini.",
  "Wah, kotakku jadi hangat.",
  "Terima kasih! Isiku jadi ringan.",
  "Lagi dong… eh, sedikit saja.",
];

export const PAT_MANY = [
  "Ampun, aku bukan bantal!",
  "Kamu betah ya mengusap kotak.",
  "Kalau begini terus, aku lupa tugas.",
  "Stop, stop, aku mulai pusing!",
];

export const IDLE = [
  "Aku kotak, tapi ruang di hatiku luas.",
  "Pita pink ini tidak boleh lepas.",
  "Jangan menumpuk barang berat di atasku, ya.",
  "Paket yang rapi bikin hati tenang.",
  "Aku cuma lihat-lihat, seperti kurir yang lagi istirahat.",
  "Fragile? Sedikit. Tangguh? Sangat.",
  "Sedang mengecek sudut kardus. Pas!",
  "Kalau bosan, klik aku atau seret ke mana saja.",
  "Ada ongkir yang perlu kukejar?",
  "Lakban, kardus, pita. Hidup sederhana.",
];

export const WAKE = [
  "Eh, aku ketiduran di atas palet.",
  "Zzz… oh, sudah pagi?",
  "Aku tidak tidur, cuma menutup mata sebentar.",
  "Hoaam. Tadi sampai mana?",
];

export const DIZZY = [
  "Kotakku berputar! Pelan-pelan…",
  "Duh, isinya jadi goyang.",
  "Pusing, pusing. Jangan dikocok.",
];

export const PICKUP = ["Wah, aku diangkat!", "Hati-hati, jangan dibanting.", "Mau dipindah ke mana?"];

export const DROP = ["Di sini lumayan.", "Oke, parkir di sini.", "Nyaman. Terima kasih."];

export const FLY = [
  "Wuss, tapi pelan-pelan.",
  "Terbang sebentar, ya.",
  "Aku melayang, bukan kabur.",
  "Lewat udara, hemat tangga.",
];

export const FALL = [
  "Turun pelan, jangan sampai penyok.",
  "Meluncur ke bawah… santai.",
  "Pegangan pita!",
  "Mendarat dengan sopan.",
];

const lastPicked = new Map<string, string>();

/** Ambil satu kalimat acak dari kumpulan, hindari yang sama dengan pilihan terakhir untuk kunci itu. */
export function pickFresh(key: string, pool: readonly string[]) {
  if (pool.length <= 1) return pool[0] ?? "";
  let line = pool[Math.floor(Math.random() * pool.length)];
  while (line === lastPicked.get(key)) line = pool[Math.floor(Math.random() * pool.length)];
  lastPicked.set(key, line);
  return line;
}
