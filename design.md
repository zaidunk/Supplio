# design.md — Sistem Desain Supplio

> Sumber kebenaran visual untuk Supplio. Sumber kebenaran **produk** tetap [SUPPLIO.md](SUPPLIO.md); jika ada konflik istilah atau perilaku, SUPPLIO.md menang.
> Dokumen ini hanya mendefinisikan tampilan. Tidak ada kode aplikasi atau aset brand yang diubah olehnya.

---

## 0. Hasil analisis workspace (dasar semua keputusan)

| Aspek | Temuan (dari SUPPLIO.md, README.md, package.json, kode `src/`) |
|---|---|
| Produk | **Supplio — AI-Assisted Inventory & Procurement untuk UMKM.** Agen AI memantau stok, meminta penawaran dan bernegosiasi dengan **supplier manusia lewat Telegram**, lalu merekomendasikan kombinasi pembelian berbiaya terendah. **Pemilik tetap memberi Final Approval.** |
| Industri / pengguna | UMKM. Persona utama: **pemilik UMKM** (satu-satunya yang login dan menyetujui). Persona sekunder: **supplier** (manusia, hanya berinteraksi di Telegram, tidak memakai web app). |
| Fitur nyata | Dashboard, Inventory (produk, pergerakan stok, permintaan penawaran manual), Supplier (onboarding Telegram), Procurement (rekomendasi, Final Approval, PO), Penerimaan barang, Pengaturan (budget, gaya AI). |
| Nilai inti | Transparan (status terlihat, bukan proses AI tersembunyi); aman (AI tak bisa menyetujui, batas keuangan ditegakkan kode); hemat (optimasi total harga item + ongkir). |
| Bahasa & format | Antarmuka **Bahasa Indonesia**, mata uang **IDR**, zona waktu `Asia/Jakarta`. |
| Tone | Tenang, jelas, jujur, membantu. Bukan hype. |
| Stack | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui gaya `base-nova` di atas `@base-ui/react`, `class-variance-authority`, `lucide-react`. Font saat ini Geist (belum diganti). Token warna saat ini masih netral bawaan shadcn (grayscale). |
| UI saat ini | Header atas dengan teks "Supplio" + tautan nav; kartu & tabel polos. Belum memakai logo. Belum ada palet brand. |

**Implikasi desain:** Supplio adalah *aplikasi kerja* (dashboard/tabel/form/approval), bukan situs pemasaran. Bahasa visual editorial dan aksen berani dipakai di halaman login, header halaman, empty state, dan sorotan angka; area padat data memprioritaskan keterbacaan. Belum ada halaman landing di workspace, jadi pola landing di §11 adalah **panduan bersyarat** untuk kelak, bukan perintah membuatnya.

---

## 1. Filosofi desain & arah visual

**Arah:** *Modern Minimalist Editorial SaaS dengan aksen cerah dan kedalaman 3D lembut.*

Prinsip, berurutan menurut prioritas:

1. **Kejelasan sebelum gaya.** Pemilik UMKM mengambil keputusan uang. Angka, status, dan tombol Approve harus selalu paling jelas di layar.
2. **Status itu kelas satu.** Setiap proses AI (menunggu balasan supplier, perlu klarifikasi, `NO_FEASIBLE_SOLUTION`) punya representasi visual eksplisit. Jangan menyembunyikannya.
3. **Biru memimpin, merah muda menyorot.** Biru tua = identitas, struktur, aksi utama. Merah muda = satu sorotan per area (kata penting, penanda "Rekomendasi", dekorasi). Lihat §3.
4. **Editorial, bukan template.** Judul besar dan rapat, kolom asimetris, banyak ruang kosong, angka sebagai elemen grafis. Hindari tampilan dashboard generik abu-abu dengan kartu seragam.
5. **Kedalaman secukupnya.** Bayangan lembut, lapisan, dan elemen mengambang untuk membangun hierarki, bukan hiasan.
6. **Jujur.** Data demo berlabel simulasi (aturan proyek). Tidak ada angka/testimoni rekaan di UI produksi.

---

## 2. Identitas brand & penggunaan aset

### 2.1 Aset resmi (di root repo)

| Berkas | Isi | Dimensi (viewBox) | Rasio | Warna di dalam berkas |
|---|---|---|---|---|
| `Icon.svg` | Ikon brand: kotak/paket 3D berbidang putih dengan kontur hitam, bagian biru dan merah muda | `364 × 350` | ≈ 1.04 : 1 | `#053182`, `#073383`, `#033182` (biru), `#FE7EAD`, `#FC7FAD` (merah muda), putih, stroke hitam |
| `Text.svg` | Wordmark "Supplio" | `819 × 238` | ≈ 3.44 : 1 | `#033182` (biru), `#FC7FAD` (merah muda) |

Kedua berkas **tidak boleh diubah**: tidak digambar ulang, tidak diwarnai ulang, tidak diberi efek, tidak diubah proporsinya, tidak diganti teks/emoji/ikon generik.

> **Catatan konsistensi warna.** Biru dan merah muda di dalam SVG (`#033182`, `#FC7FAD`) sedikit berbeda dari token brand UI (`#0A2E8C`, `#FC90CB`). Ini wajar dan **bukan bug**: SVG dipakai apa adanya; token UI dipakai untuk elemen antarmuka. Jangan "menyeragamkan" dengan mengedit SVG, dan jangan memakai warna SVG sebagai token UI.

### 2.2 Kapan memakai yang mana

| Konteks | Aset | Ukuran |
|---|---|---|
| Header aplikasi (desktop/tablet) | `Text.svg` (wordmark) | tinggi 28 px (lebar ≈ 96 px) |
| Header aplikasi (mobile < 640 px), sidebar ciut, avatar bot | `Icon.svg` saja | 32 px tinggi |
| Favicon / ikon tab / PWA | `Icon.svg` (bentuk kotak; sediakan turunan raster 32/180/512 px dari berkas asli tanpa mengubah gambar) | — |
| Halaman login | `Icon.svg` besar sebagai fokus visual **atau** wordmark di atas kartu | ikon 72–96 px, atau wordmark tinggi 40 px |
| Empty state, loading penuh layar | `Icon.svg` | 48–64 px |
| Open Graph / dokumen ekspor | Ikon + wordmark berdampingan (lockup tersusun dari dua berkas asli, jarak tetap §2.3) | — |

Hanya satu logo per area pandang. Jangan menampilkan ikon **dan** wordmark berdampingan di header yang sama kecuali dalam lockup resmi di §2.3.

### 2.3 Lockup horizontal (ikon + wordmark)

- Tinggi ikon = **1.0×**, tinggi wordmark = **0.7×** tinggi ikon, sejajar tengah vertikal.
- Jarak antar keduanya = **0.35×** tinggi ikon.
- Dirakit dari dua berkas asli; **tidak** diekspor menjadi SVG baru yang menimpa aset.

### 2.4 Clear space & ukuran minimum

- Clear space di semua sisi = **½ tinggi ikon** (atau ½ tinggi huruf "S" pada wordmark).
- Minimum: ikon **20 px** tinggi, wordmark **20 px** tinggi (lebar ≈ 69 px). Di bawahnya gunakan ikon saja, atau jangan tampilkan logo.

### 2.5 Latar yang diizinkan

- Aman: `#FDFBFE` (Soft White), putih, tint biru sangat muda (`--blue-50`), tint merah muda sangat muda (`--pink-50`).
- Di atas Deep Blue (`#0A2E8C`) atau foto: **jangan** menaruh SVG langsung (teks biru hilang). Letakkan di atas "chip" Soft White berpadding `12px` dan radius `--radius-md`. Tidak membuat versi putih baru.
- Jangan menaruh logo di atas gradien ramai atau pola.

### 2.6 Cara memuat di Next.js

Salin aset ke `public/brand/` (salinan byte-identik, mis. `public/brand/icon.svg`, `public/brand/wordmark.svg`; berkas root tetap sumber). Pakai `next/image` dengan `width`/`height` sesuai rasio di atas, `alt="Supplio"` (ikon dekoratif di samping teks "Supplio": `alt=""`). Jangan memakai `fill` yang memotong, jangan `object-fit: cover`.

```tsx
<Image src="/brand/wordmark.svg" alt="Supplio" width={96} height={28} priority />
// 819/238 ≈ 3.44 → 96×28; jangan paksa rasio lain
```

---

## 3. Palet warna & token

### 3.1 Warna inti (tetap, dari brief)

| Nama | Hex | Peran |
|---|---|---|
| **Soft White** | `#FDFBFE` | Latar dominan, permukaan kartu |
| **Deep Blue** | `#0A2E8C` | Identitas, judul, tombol utama, tautan, fokus |
| **Vibrant Pink** | `#FC90CB` | Aksen: sorotan, dekorasi, penanda sekunder |

### 3.2 Turunan (tint/shade dari tiga warna inti)

Skala dibuat dari tiga warna di atas; tidak ada hue baru.

| Token | Hex | Catatan |
|---|---|---|
| `--blue-950` | `#061A52` | Teks di atas tint, hover gelap |
| `--blue-800` | `#08246F` | Hover/active tombol utama |
| `--blue-700` | `#0A2E8C` | **Deep Blue** (basis) |
| `--blue-500` | `#3B5DB8` | Ikon aktif, grafik seri 2 |
| `--blue-300` | `#9DB0E0` | Garis grafik sekunder, border aktif lembut |
| `--blue-100` | `#DCE3F5` | Latar chip/aksen lembut |
| `--blue-50` | `#EEF1FA` | Latar seksi, hover baris tabel |
| `--pink-600` | `#C9467F` | Teks merah muda di atas terang (kontras ≥ 4.5:1) |
| `--pink-500` | `#FC90CB` | **Vibrant Pink** (basis) |
| `--pink-300` | `#FDB9DD` | Dekorasi, blob gradien |
| `--pink-100` | `#FEE3F1` | Latar badge/callout merah muda |
| `--pink-50` | `#FFF2F9` | Latar sorotan sangat halus |

### 3.3 Netral pendukung

Netral sedikit condong ke biru agar harmonis dengan Deep Blue.

| Token | Hex | Pakai untuk |
|---|---|---|
| `--ink` | `#0E1428` | Teks isi (pengganti hitam murni) |
| `--ink-muted` | `#4A5270` | Teks sekunder, label, caption |
| `--ink-subtle` | `#6E7591` | Placeholder, metadata (hanya teks ≥ 14 px) |
| `--line` | `#E4E6F0` | Border tipis default |
| `--line-strong` | `#CDD1E3` | Border input, pemisah kuat |
| `--surface` | `#FDFBFE` | Kartu, popover (= Soft White) |
| `--surface-raised` | `#FFFFFF` | Elemen mengambang di atas Soft White |
| `--surface-sunken` | `#F6F4F9` | Latar area lekuk, kolom tabel zebra halus |

### 3.4 Warna status (fungsional, bukan dekoratif)

Aplikasi punya status nyata (diterima, ditolak, peringatan stockout, kegagalan). Biru/merah muda tidak boleh memikul makna benar/salah, jadi tersedia warna status **terbatas** yang dipakai **hanya** pada badge, ikon status, dan pesan galat/peringatan. Jangan jadikan dominan atau dekorasi.

| Token | Teks/ikon | Latar | Untuk |
|---|---|---|---|
| `--success` | `#17663F` | `#E3F4EA` | Diterima, selesai, dikonfirmasi |
| `--warning` | `#8A5A00` | `#FFF1D6` | Risiko stockout, overbuy, perlu klarifikasi |
| `--danger` | `#B3261E` | `#FCE6E4` | Galat, ditolak, `NO_FEASIBLE_SOLUTION`, hapus |
| `--info` | `#0A2E8C` | `#EEF1FA` | Informasi netral, menunggu (memakai biru brand) |

Status **tidak boleh hanya berbeda warna**: selalu sertakan ikon dan/atau label teks (§14).

### 3.5 Distribusi warna (aturan 60-30-10)

- ~**70%** Soft White + netral.
- ~**22%** Deep Blue + turunan biru (teks judul, tombol utama, nav aktif, seksi sorotan penuh lebar).
- ~**8%** Vibrant Pink + turunan (satu sorotan per viewport).

**Aturan merah muda:** maksimal **satu** sorotan merah muda "berteriak" per area pandang (mis. satu kata di judul, atau satu badge, atau satu blob). Merah muda **bukan** warna teks isi dan **bukan** warna tombol utama.

### 3.6 Kontras terverifikasi (perhitungan WCAG)

| Pasangan | Rasio ≈ | Pakai untuk |
|---|---|---|
| Deep Blue `#0A2E8C` di atas Soft White | **11.6 : 1** | Semua teks, tombol utama (teks putih di atas biru juga ≥ 11:1) |
| `--ink` di atas Soft White | ≥ 15 : 1 | Teks isi |
| Deep Blue di atas Vibrant Pink | **5.6 : 1** | Teks pada permukaan merah muda (boleh) |
| Vibrant Pink `#FC90CB` di atas Soft White | **2.1 : 1** | **Tidak boleh untuk teks atau garis informatif.** Dekorasi saja |
| `--pink-600` di atas Soft White | ≥ 4.5 : 1 | Teks merah muda yang perlu terbaca |

### 3.7 Token CSS (siap tempel ke `src/app/globals.css`)

Mapping ke variabel shadcn yang sudah ada, sehingga komponen `src/components/ui/*` ikut berubah tanpa diedit. Nilai `oklch` bawaan shadcn diganti hex.

```css
:root {
  /* inti */
  --soft-white: #FDFBFE;
  --blue-950: #061A52; --blue-800: #08246F; --blue-700: #0A2E8C;
  --blue-500: #3B5DB8; --blue-300: #9DB0E0; --blue-100: #DCE3F5; --blue-50: #EEF1FA;
  --pink-600: #C9467F; --pink-500: #FC90CB; --pink-300: #FDB9DD;
  --pink-100: #FEE3F1; --pink-50: #FFF2F9;
  --ink: #0E1428; --ink-muted: #4A5270; --ink-subtle: #6E7591;
  --line: #E4E6F0; --line-strong: #CDD1E3;
  --surface-raised: #FFFFFF; --surface-sunken: #F6F4F9;
  --success: #17663F; --success-bg: #E3F4EA;
  --warning: #8A5A00; --warning-bg: #FFF1D6;
  --danger: #B3261E;  --danger-bg: #FCE6E4;

  /* mapping shadcn */
  --background: var(--soft-white);
  --foreground: var(--ink);
  --card: var(--soft-white);
  --card-foreground: var(--ink);
  --popover: var(--surface-raised);
  --popover-foreground: var(--ink);
  --primary: var(--blue-700);
  --primary-foreground: #FFFFFF;
  --secondary: var(--blue-50);
  --secondary-foreground: var(--blue-700);
  --muted: var(--surface-sunken);
  --muted-foreground: var(--ink-muted);
  --accent: var(--pink-100);
  --accent-foreground: var(--blue-950);
  --destructive: var(--danger);
  --border: var(--line);
  --input: var(--line-strong);
  --ring: var(--blue-700);
  --radius: 0.75rem; /* 12px: lihat §7 */
  --chart-1: var(--blue-700); --chart-2: var(--pink-500);
  --chart-3: var(--blue-500); --chart-4: var(--blue-300); --chart-5: var(--pink-300);
  --sidebar: var(--soft-white);
  --sidebar-foreground: var(--ink);
  --sidebar-primary: var(--blue-700);
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: var(--blue-50);
  --sidebar-accent-foreground: var(--blue-700);
  --sidebar-border: var(--line);
  --sidebar-ring: var(--blue-700);
}
```

**Mode gelap:** bukan bagian dari arah desain saat ini. Jangan membuat `.dark` baru sebelum diminta; bila kelak diminta, turunkan dari skala di atas (latar `--blue-950`, teks Soft White, aksen merah muda tetap `#FC90CB`) dan uji ulang kontras. Sampai itu, hapus ketergantungan visual pada blok `.dark` bawaan (tidak dipakai).

---

## 4. Sistem tipografi

### 4.1 Pilihan font

| Peran | Font | Alasan |
|---|---|---|
| **Utama (judul + isi + UI)** | **Plus Jakarta Sans** | Geometris, hangat, bentuk huruf terbuka untuk teks Indonesia, bobot 400–800 lengkap, gratis via `next/font/google`. Cocok untuk kepribadian ramah-tapi-tegas. |
| **Mono (kode, ID, token, SKU)** | **Geist Mono** (sudah terpasang) | Dipertahankan agar tidak menambah dependensi. |

Alternatif cadangan bila Plus Jakarta tak tersedia: Manrope → Inter. Hanya **satu** keluarga sans yang dipakai. Jangan mencampur.

Penerapan di `src/app/layout.tsx` (saat implementasi): ganti `Geist` dengan `Plus_Jakarta_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400","500","600","700","800"] })`. Variabel `--font-sans` dan `--font-heading` sudah dipetakan di `globals.css`.

### 4.2 Bobot yang dipakai (hanya 4)

`400` isi · `500` label/UI · `700` judul bagian & tombol penting · `800` judul display (H1/hero). Tidak memakai 300 atau 900.

### 4.3 Skala tipografi

Ukuran fluid dengan `clamp()` untuk judul; isi tetap statis. Line-height judul **rapat**, isi **nyaman**.

| Token | Ukuran (mobile → desktop) | Bobot | Line-height | Letter-spacing | Pakai untuk |
|---|---|---|---|---|---|
| `display` | `clamp(2.5rem, 6vw, 4.5rem)` | 800 | 1.02 | −0.035em | Hero/halaman login/landing (bila ada) |
| `h1` | `clamp(2rem, 4vw, 3rem)` | 800 | 1.08 | −0.03em | Judul halaman |
| `h2` | `clamp(1.5rem, 2.6vw, 2rem)` | 700 | 1.15 | −0.02em | Judul bagian |
| `h3` | `1.25rem` (20 px) | 700 | 1.25 | −0.01em | Judul kartu/panel |
| `h4` | `1.0625rem` (17 px) | 700 | 1.3 | −0.005em | Sub-judul |
| `body-lg` | `1.125rem` (18 px) | 400 | 1.6 | 0 | Paragraf pengantar |
| `body` | `1rem` (16 px) | 400 | 1.6 | 0 | Isi default |
| `body-sm` | `0.875rem` (14 px) | 400 | 1.5 | 0 | Tabel, deskripsi form, metadata |
| `label` | `0.875rem` (14 px) | 500 | 1.3 | 0.005em | Label form, nav, tombol |
| `caption` | `0.75rem` (12 px) | 500 | 1.4 | 0.01em | Caption, penanda kecil (jangan di bawah 12 px) |
| `overline` | `0.75rem` (12 px) | 700 | 1.2 | 0.08em, UPPERCASE | Penanda bagian di atas judul (mis. "PROCUREMENT"), pakai hemat |
| `stat` | `clamp(2rem, 4vw, 3rem)` | 800 | 1.0 | −0.03em | Angka besar di dashboard |

Aturan:

- **Angka uang dan kuantitas** di tabel/perbandingan: `font-variant-numeric: tabular-nums`, rata kanan. Format rupiah hanya di lapisan presentasi: `Rp 1.250.000` (titik ribuan, spasi setelah "Rp"), memakai `Intl.NumberFormat("id-ID")` (SUPPLIO.md §2).
- **Penekanan warna di judul:** satu frasa (1–3 kata) boleh diwarnai `--pink-500` **hanya** pada ukuran `display`/`h1` (besar, jadi kontrasnya sebagai dekorasi diterima) atau ditandai dengan garis bawah merah muda tebal. Di `h2` ke bawah gunakan `--blue-700` atau `--pink-600`.
- Panjang baris isi maksimal **68 karakter** (`max-width: 68ch`).
- Hindari italic, underline dekoratif, huruf kapital penuh selain `overline`.
- Perataan kiri selalu; tengah hanya untuk empty state dan login.

---

## 5. Layout & sistem grid

### 5.1 Lebar konten

| Konteks | Lebar maks |
|---|---|
| Halaman aplikasi (dashboard, tabel) | `1280px` |
| Halaman form/pengaturan | `880px` |
| Teks bacaan | `68ch` |
| Halaman login | kartu `420px` |
| Landing (bila kelak ada) | `1200px` |

Wadah: `mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10`.

### 5.2 Grid

- **12 kolom**, gutter `24px` (desktop), `16px` (tablet), `16px` (mobile 4 kolom).
- **Asimetri terkontrol:** pola utama **7/5** atau **8/4** (teks/data besar : panel pendukung). Pola 6/6 simetris hanya untuk perbandingan setara (mis. dua supplier). Hindari rangkaian kartu 3 sama-besar berulang sebagai satu-satunya struktur.
- Elemen dekoratif atau ilustrasi boleh **keluar dari grid** hingga 48 px (bleed) pada desktop, tapi tidak boleh menyebabkan scroll horizontal.
- Kerangka aplikasi: **header atas** tetap (tinggi 64 px) berisi logo, navigasi, nama bisnis, tombol Keluar. Di ≥ 1024 px navigasi boleh dialihkan ke sidebar kiri 248 px (ciut 72 px berisi ikon + tooltip) bila jumlah menu bertambah; keputusan ini milik implementasi, bukan wajib.

### 5.3 Ritme vertikal

Jarak antar bagian halaman: `48px` (mobile) · `64px` (tablet) · `96px` (desktop). Di dalam bagian: gunakan skala §6.

---

## 6. Sistem spasi

Basis **4 px**. Hanya nilai skala ini yang dipakai (di Tailwind: kelipatan 1 = 4 px).

| Token | px | Tailwind | Pakai untuk |
|---|---|---|---|
| `--space-1` | 4 | `1` | Jarak ikon–teks rapat |
| `--space-2` | 8 | `2` | Jarak elemen berkaitan |
| `--space-3` | 12 | `3` | Padding badge/tombol kecil |
| `--space-4` | 16 | `4` | Gutter mobile, padding form |
| `--space-5` | 20 | `5` | Jarak antar field |
| `--space-6` | 24 | `6` | Padding kartu, gutter desktop |
| `--space-8` | 32 | `8` | Padding kartu besar, jarak antar kartu |
| `--space-10` | 40 | `10` | Margin halaman desktop |
| `--space-12` | 48 | `12` | Jarak bagian (mobile) |
| `--space-16` | 64 | `16` | Jarak bagian (tablet) |
| `--space-24` | 96 | `24` | Jarak bagian (desktop) |

Padding komponen standar: kartu `24px` (`32px` untuk kartu sorotan); sel tabel `12px 16px`; input `0 14px`; tombol `0 20px`.

Target sentuh minimum **44 × 44 px** (§14) walau tampilan lebih kecil: perluas area klik dengan padding atau `::after`.

---

## 7. Bahasa bentuk & radius

Kombinasi **persegi panjang membulat** untuk wadah dan **pil** hanya untuk elemen kecil berbentuk label. Tidak semua dibuat pil.

| Token | Nilai | Pakai untuk |
|---|---|---|
| `--radius-xs` | 6px | Chip kode/ID kecil, checkbox |
| `--radius-sm` | 8px | Input kecil, item menu |
| `--radius-md` | 12px | **Default**: input, tombol, dropdown, badge persegi |
| `--radius-lg` | 16px | Kartu, panel, tabel pembungkus |
| `--radius-xl` | 24px | Kartu sorotan, modal, panel mengambang besar |
| `--radius-2xl` | 32px | Hero/seksi sorotan penuh lebar |
| `--radius-full` | 9999px | **Hanya**: badge status, tag, tombol CTA utama di hero/login, avatar, toggle |

Aturan:

- **Tombol:** CTA utama di hero/login/Approve besar = pil. Tombol di tabel/form/toolbar = `--radius-md`. Jangan memadukan dua gaya di satu toolbar.
- **Border:** `1px solid var(--line)`, tipis. Penekanan = `--line-strong` atau `--blue-300`, bukan menebalkan.
- **Radius konsisten dalam satu kelompok:** radius elemen dalam = radius luar − padding (mis. kartu 16 px berisi chip 8 px).
- Konsekuensi: `--radius` shadcn diset ke `0.75rem` (§3.7). Skala turunan shadcn (`sm=0.6×`, `lg=1×`, `xl=1.4×` dst.) tetap dipakai; tombol/input default otomatis ≈ 9–12 px. Badge shadcn bawaan `rounded-4xl` sudah pil, sesuai aturan di atas.

---

## 8. Bayangan, gradien & efek visual

### 8.1 Bayangan (lembut, berwarna biru, bukan hitam pekat)

```css
:root {
  --shadow-xs: 0 1px 2px rgba(10, 46, 140, 0.06);
  --shadow-sm: 0 2px 6px rgba(10, 46, 140, 0.07), 0 1px 2px rgba(10, 46, 140, 0.05);
  --shadow-md: 0 8px 24px -6px rgba(10, 46, 140, 0.12), 0 2px 6px rgba(10, 46, 140, 0.05);
  --shadow-lg: 0 20px 48px -12px rgba(10, 46, 140, 0.18), 0 4px 12px rgba(10, 46, 140, 0.06);
  --shadow-pink: 0 12px 32px -8px rgba(252, 144, 203, 0.45);
  --ring-focus: 0 0 0 3px rgba(10, 46, 140, 0.25);
}
```

| Elevasi | Token | Pakai untuk |
|---|---|---|
| 0 | tanpa bayangan, `border` saja | Kartu data, tabel (default; **datar & tenang**) |
| 1 | `--shadow-xs` | Input, tombol sekunder saat hover |
| 2 | `--shadow-sm` | Kartu interaktif (hover), dropdown |
| 3 | `--shadow-md` | Popover, panel mengambang, toast |
| 4 | `--shadow-lg` | Modal/dialog, elemen "mengambang" di hero |
| akses | `--shadow-pink` | Satu elemen sorotan merah muda (maks. satu per viewport) |

Kartu data di area kerja **tidak** memakai bayangan berat; kedalaman dicadangkan untuk elemen yang benar-benar terangkat.

### 8.2 Gradien (turunan palet saja)

| Token | Definisi | Pakai |
|---|---|---|
| `--grad-blue` | `linear-gradient(135deg, #0A2E8C 0%, #3B5DB8 100%)` | Seksi sorotan penuh lebar, kartu "Rekomendasi" besar |
| `--grad-wash` | `radial-gradient(60% 60% at 80% 0%, #FEE3F1 0%, transparent 70%), radial-gradient(50% 50% at 0% 10%, #DCE3F5 0%, transparent 70%)` | Latar halus header halaman/login (di atas Soft White) |
| `--grad-pink` | `linear-gradient(135deg, #FDB9DD 0%, #FC90CB 100%)` | Blob/bentuk dekoratif |

Gradien selalu halus (selisih terang kecil), tidak pelangi, tidak lebih dari dua warna dasar.

### 8.3 Blur & transparansi

- **Header menempel** (sticky): `background: rgb(253 251 254 / 0.8); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line)`.
- **Kartu kaca** (hanya di atas gradien/dekorasi): `background: rgb(255 255 255 / 0.7); backdrop-filter: blur(16px); border: 1px solid rgb(255 255 255 / 0.6)`.
- Sediakan fallback: bila `backdrop-filter` tak didukung, gunakan latar solid `--surface-raised`.
- Overlay modal: `rgb(6 26 82 / 0.45)` (biru gelap, bukan hitam).

### 8.4 Bentuk geometris abstrak

Lingkaran, blob membulat, dan kotak miring (mengambil bahasa **kotak/paket** dari `Icon.svg`) boleh dipakai sebagai latar dekoratif berlapis: warna `--pink-300`, `--blue-100`, `--blue-300` dengan opasitas 40–70%, `aria-hidden`, `pointer-events: none`, dan **tidak pernah menutupi teks atau data**. Maksimal 2–3 bentuk per area.

### 8.5 Gerak

Durasi `150ms` (hover/fokus), `220ms` (muncul/hilang), `400ms` (transisi halaman, maks.). Easing `cubic-bezier(0.2, 0.7, 0.2, 1)`. Gerakan yang didukung: naik 2–4 px + bayangan saat hover kartu, fade/slide lembut pada panel. **Hormati `prefers-reduced-motion`**: nonaktifkan semua gerak non-esensial.

---

## 9. Komponen UI & panduan gaya

Komponen dasar sudah ada di `src/components/ui/` (shadcn `base-nova`). **Gaya diubah lewat token (§3.7) dan varian CVA**, bukan dengan menyalin ulang komponen. Spesifikasi di bawah adalah target tampilan.

### 9.1 Tombol

| Varian | Tampilan | Pakai |
|---|---|---|
| **Primary** | Latar `--blue-700`, teks putih, `--radius-md`, tinggi 40 px (default) / 48 px (lg), bobot 600. Hover `--blue-800` + `--shadow-sm`. Active `translateY(1px)`. | Satu aksi utama per area (mis. Approve, Simpan, Masuk) |
| **Primary-pill (CTA)** | Seperti Primary tetapi `--radius-full`, tinggi 48–56 px, panah `→` opsional | Login, aksi hero |
| **Secondary** | Latar `--blue-50`, teks `--blue-700`, tanpa border | Aksi pendukung |
| **Outline** | Latar transparan, `1px solid var(--line-strong)`, teks `--ink`. Hover latar `--blue-50`, border `--blue-300` | Aksi netral (Keluar, Batal) |
| **Ghost** | Tanpa latar, teks `--ink-muted`, hover `--blue-50` | Aksi tersier, ikon toolbar |
| **Accent** | Latar `--pink-500`, teks `--blue-950` (kontras ≥ 5:1), `--shadow-pink` saat hover | **Maksimal satu per layar**; untuk sorotan non-kritis saja |
| **Destructive** | Latar `--danger-bg`, teks `--danger`; konfirmasi wajib | Hapus, Tolak/Batalkan |

Keadaan: **hover** (lebih gelap/terangkat), **focus-visible** (`--ring-focus` + outline 2 px `--blue-700`, offset 2 px), **active**, **disabled** (`opacity .5`, `cursor: not-allowed`, bukan hanya mengabu), **loading** (spinner ikon di kiri, teks berubah jadi kata kerja gerund, lebar tetap, tombol `aria-busy`).

Tombol **Approve** (Final Approval) adalah elemen paling jelas di halaman rekomendasi: Primary ukuran lg dengan ringkasan total di dekatnya; **Reject/Batalkan** sebagai Outline. Jangan menaruh dua Primary berdekatan.

### 9.2 Navigasi

- **Header:** latar Soft White 80% + blur, tinggi 64 px, border bawah `--line`. Kiri: wordmark `Text.svg`. Tengah/kiri: menu (label 14/500). Kanan: nama bisnis (`--ink-muted`) + tombol Keluar (Outline).
- **Item nav:** teks `--ink-muted`; hover `--ink`; **aktif** = teks `--blue-700` bobot 600 + indikator garis bawah 2 px `--blue-700` (atau pil `--blue-50` bila sidebar). Menandai halaman aktif dengan `aria-current="page"`.
- **Mobile:** menu ciut menjadi tombol "Menu" (ikon) yang membuka panel penuh/bawah-naik berisi tautan berukuran sentuh 48 px. Ikon saja di header, wordmark disembunyikan, `Icon.svg` ditampilkan.
- Daftar menu saat ini (jangan menambah sinonim): Dashboard, Inventory, Supplier, Procurement, Penerimaan, Pengaturan.

### 9.3 Kartu & wadah

- Dasar: `--surface`, `1px solid var(--line)`, `--radius-lg`, padding 24 px, tanpa bayangan.
- **Interaktif:** hover naik 2 px, `--shadow-sm`, border `--blue-300`.
- **Sorotan/stat:** `--radius-xl`, padding 32 px; varian biru: `--grad-blue` + teks putih (satu per halaman; di dalamnya angka `stat` putih dengan satu detail `--pink-300`).
- **Kartu rekomendasi:** `--radius-xl`, border 1 px `--blue-300`, penanda "Rekomendasi" (badge merah muda) di sudut. Isi: supplier, barang, kuantitas, harga, ongkir, total, **sisa budget**, alasan pemilihan (SUPPLIO.md §3.2). Total diberi tipografi `stat`.
- Header kartu: `h3` + deskripsi `body-sm --ink-muted`. Jangan menumpuk kartu di dalam kartu lebih dari satu tingkat.

### 9.4 Input & form

- Tinggi 44 px (target sentuh), `--radius-md`, `1px solid var(--line-strong)`, latar `--surface-raised`, teks `--ink`, placeholder `--ink-subtle`.
- **Fokus:** border `--blue-700` + `--ring-focus`. **Galat:** border `--danger`, ikon + pesan di bawah (`role="alert"`, 14 px `--danger`), `aria-invalid="true"`, `aria-describedby` ke pesan. **Disabled:** latar `--surface-sunken`, teks `--ink-subtle`.
- **Label** selalu tampak di atas field (14/500, `--ink`); bukan hanya placeholder. Penanda wajib: kata "Wajib" atau tanda `*` dengan keterangan, bukan warna saja. Teks bantuan 13–14 px `--ink-muted` di bawah field.
- Tata letak form: satu kolom (`max-w 880px`); dua kolom ≥ 768 px hanya untuk field pendek berkerabat (mis. satuan + kuantitas). Jarak antar field 20 px, antar kelompok 32 px, tombol aksi di bawah rata kiri.
- Input uang: prefiks "Rp" statis, `inputmode="numeric"`, rata kanan; input kuantitas menampilkan satuan produk (`kg`, `liter`) sebagai sufiks.
- Pilihan: gunakan `native-select` yang ada (tampilan sama dengan input, ikon chevron `--ink-muted`); checkbox/radio 20 px, centang `--blue-700`.

### 9.5 Badge & tag

- Bentuk pil, tinggi 24 px, teks 12/600, ikon 12–14 px opsional.
- Varian: **netral** (`--blue-50`/`--blue-700`), **brand** (`--pink-100`/`--pink-600`, hemat), **success/warning/danger/info** sesuai §3.4.
- Selalu **ikon + teks**. Contoh status: "Menunggu balasan", "Perlu klarifikasi", "Terkonfirmasi", "Disetujui", "Diterima sebagian", "Risiko stockout", "Tidak ada solusi layak". Gunakan istilah dari SUPPLIO.md §2 dan label status yang sudah ada di kode; jangan membuat nama baru.

### 9.6 Dropdown & menu

Panel `--surface-raised`, `--radius-lg`, `1px solid var(--line)`, `--shadow-md`, padding 6 px, item `--radius-sm` tinggi 40 px, hover `--blue-50`, terpilih `--blue-100` + ikon centang, pemisah `--line`. Tutup dengan Esc; navigasi panah; fokus kembali ke pemicu.

### 9.7 Tab

Tab garis bawah (bukan kotak): teks `--ink-muted`, aktif `--blue-700` bobot 600 dengan garis 2 px `--blue-700`; garis dasar `--line`. Pemisah antar-bagian halaman pada mobile boleh bergulir horizontal dengan indikator gradasi di tepi. Gunakan `role="tablist"/"tab"/"tabpanel"`, panah kiri/kanan berpindah tab.

### 9.8 Modal & dialog

`--radius-xl`, `--surface-raised`, `--shadow-lg`, lebar 480 px (konfirmasi) / 640 px (form), padding 32 px, overlay biru gelap 45%. Judul `h3`, penjelasan `body-sm`, aksi di kanan bawah (Primary di paling kanan, Outline di kirinya). Fokus terkunci di dalam, Esc menutup, fokus kembali ke pemicu. Mobile: panel naik dari bawah, radius atas 24 px, lebar penuh.

**Dialog konfirmasi tindakan berisiko** (Approve, Reject, hapus): sebutkan akibat konkret (total Rp, jumlah supplier/PO yang akan dibuat, tak bisa dibatalkan bila benar). Tombol berisi kata kerja spesifik ("Setujui & buat 2 PO"), bukan "OK".

### 9.9 Komponen dashboard

- **Stat tile:** `overline` label, angka `stat`, delta/keterangan `caption`. Satu tile boleh bergaya biru penuh; tile lain datar putih.
- **Daftar stok berisiko:** baris dengan nama produk, `Inventory Position` vs `Reorder Point`, bilah progres tipis (tinggi 6 px, radius penuh; isi `--blue-700`, lintasan `--blue-100`; di bawah `Reorder Point` ganti isi ke `--warning`).
- **Timeline negosiasi/procurement:** garis vertikal `--line`, titik 12 px (selesai: `--blue-700`, berjalan: `--pink-500` dengan denyut halus, gagal: `--danger`), setiap langkah berlabel teks.
- **Pesan percakapan supplier:** gelembung `--radius-lg`; pesan AI latar `--blue-50` dengan penanda "AI Supplio" (identitas AI harus jelas, SUPPLIO.md §1.6), pesan supplier latar putih berborder. Pesan mentah tidak diberi gaya markdown berbahaya (teks polos).
- **Empty state:** `Icon.svg` 56 px (bukan ilustrasi acak), judul `h3`, satu kalimat, satu tombol. Contoh: "Belum ada procurement request" + tombol ke Inventory.
- **Skeleton loading:** blok `--surface-sunken` dengan shimmer halus (nonaktif saat reduced motion).

### 9.10 Tabel & data

- Pembungkus `--radius-lg`, border `--line`, `overflow-x: auto`.
- Header: latar `--surface-sunken`, teks `overline`-ish 12/700 `--ink-muted`, tinggi 44 px, sticky bila tabel panjang. Baris: tinggi min. 52 px, border bawah `--line`, hover `--blue-50`. Tanpa zebra kecuali tabel > 15 kolom.
- Kolom angka (Rp, kuantitas, stok) rata kanan, `tabular-nums`; teks rata kiri; aksi di kolom terakhir rata kanan (ghost/ikon, `aria-label` jelas).
- Ringkasan baris total pakai bobot 700 dan border atas `--line-strong`. Nilai uang negatif/sisa budget menipis diberi ikon + teks, bukan hanya warna.
- Mobile: tabel padat diubah jadi **daftar kartu** per baris (judul = nama, pasangan label–nilai di bawahnya), atau tabel dengan scroll horizontal + kolom pertama sticky.
- **Visualisasi data:** ≤ 5 seri, urutan warna `--chart-1…5` (biru → merah muda → biru muda), garis 2 px, sumbu `--line`, label 12 px `--ink-muted`, tooltip gaya popover. Jangan mengandalkan warna saja: tambahkan pola/label langsung. Grafik hanya untuk data yang memang ada di sistem; **jangan menggambar grafik tren fiktif**.

---

## 10. Ikonografi & arah ilustrasi

### 10.1 Ikon

- Pustaka resmi: **`lucide-react`** (sudah terpasang, `components.json` → `iconLibrary: "lucide"`). Hanya satu pustaka.
- Garis tipis: `strokeWidth={1.75}`, ukuran 16 px (inline/badge), 20 px (tombol/nav), 24 px (judul kartu), 32–48 px (empty state). Warna mengikuti teks (`currentColor`).
- Jangan mengganti logo dengan ikon lucide, jangan menggunakan emoji di UI.
- Ikon dekoratif: `aria-hidden="true"`; ikon fungsional tanpa teks: `aria-label`.

### 10.2 Ilustrasi & 3D lembut

- Motif identitas = **kotak/paket 3D** dari `Icon.svg` (kiriman, stok, pesanan). Visual pendukung boleh mengambil bahasa itu: kubus/kotak isometrik lembut berwarna `--blue-100`/`--pink-300` dengan bayangan lembut.
- **Hanya visual yang relevan produk:** mockup antarmuka (kartu rekomendasi, percakapan Telegram, tabel stok), visualisasi abstrak aliran stok → penawaran → persetujuan, atau kotak paket 3D sebagai penanda kosong/berhasil. **Tidak** ada ilustrasi 3D acak (orang, planet, koin) hanya sebagai pengisi.
- Mockup UI yang ditampilkan harus **berasal dari antarmuka sungguhan** (tangkapan layar atau komponen nyata) dan berlabel **"Data simulasi"** bila isinya demo (aturan proyek). Jangan menampilkan angka penghematan, jumlah pengguna, atau testimoni yang tak ada di sistem.
- Elemen mengambang: kartu mini (badge status, potongan pesan supplier) bertumpuk dengan offset 12–24 px, `--shadow-md`/`--shadow-lg`, rotasi maks. ±3°. Jangan dipakai di halaman kerja padat data.
- Format: SVG untuk bentuk, WebP/AVIF untuk raster, selalu dengan `alt` bermakna atau `alt=""` bila dekoratif.

---

## 11. Komposisi halaman & pola bagian

### 11.1 Halaman aplikasi (prioritas)

Anatomi standar halaman kerja:

1. **Header halaman:** `overline` (nama modul, mis. "PROCUREMENT"), `h1` (boleh satu frasa berwarna merah muda), deskripsi satu kalimat `body-lg --ink-muted`, aksi utama di kanan (Primary). Latar `--grad-wash` halus.
2. **Baris ringkasan:** 3–4 stat tile; satu bergaya sorotan (asimetri, bukan empat sama).
3. **Konten utama + panel samping (8/4):** tabel/daftar di kiri; panel status/aksi cepat/peringatan di kanan.
4. **Detail bertahap:** gunakan *progressive disclosure* (tab, panel lipat) alih-alih menumpuk semua data.

Per halaman:

| Halaman | Fokus visual |
|---|---|
| **Dashboard** | Satu kartu sorotan biru: status procurement aktif. Di bawahnya: stok berisiko, percakapan/penawaran supplier, rekomendasi biaya, approval menunggu. Status AI terlihat jelas (timeline). |
| **Inventory** | Tabel produk; indikator `Inventory Position` vs `Reorder Point`; panel "Minta penawaran manual" (SUPPLIO.md §4.1) dengan peringatan overbuy/risiko sebagai callout `--warning`. |
| **Supplier** | Kartu/tabel supplier dengan status koneksi Telegram (badge), aksi "Hubungkan Telegram". |
| **Procurement** | Daftar request + detail: timeline sesi negosiasi, kartu penawaran, **kartu rekomendasi** dengan Approve/Reject. Bila `NO_FEASIBLE_SOLUTION`, tampilkan penjelasan constraint dan alternatif (callout `--danger-bg`), tanpa mengemasnya sebagai kegagalan sistem. |
| **Penerimaan** | Form penerimaan sebagian/penuh dengan ringkasan PO di samping. |
| **Pengaturan** | Form satu kolom; pemisahan jelas antara pengaturan keuangan (`Restock Budget`) dan gaya AI (`communicationTone`, `negotiationStyle`, `customInstructions`); catatan bahwa gaya AI tidak mengubah aturan keamanan/keuangan. |
| **Login** | Komposisi 2 kolom asimetris ≥ 1024 px: kiri latar `--grad-wash` + `Icon.svg` besar + `display` pendek; kanan kartu login 420 px. Mobile: kartu saja dengan ikon di atas. |

### 11.2 Pola landing (bersyarat, hanya bila kelak diminta)

Tidak ada situs pemasaran saat ini; ini panduan, **bukan** daftar halaman yang wajib dibuat. Bila dibuat, susunan modular:

1. **Hero** asimetris 7/5: kiri `display` + subjudul + CTA pil + CTA outline; kanan mockup antarmuka berlapis (kartu rekomendasi, percakapan, status) dengan elemen mengambang yang menembus tepi kolom.
2. **Cara kerja:** 4 langkah bernomor sesuai alur nyata (stok menipis → AI meminta penawaran via Telegram → optimasi biaya → pemilik menyetujui). Angka langkah besar (`stat`).
3. **Fitur:** kartu modular berukuran beragam (bento), masing-masing menyentuh satu kemampuan nyata dari SUPPLIO.md §3.
4. **Sorotan penuh lebar** `--grad-blue` untuk prinsip kendali pemilik (persetujuan tetap di tangan pemilik).
5. **Kepercayaan/keamanan:** apa yang AI **tidak** boleh lakukan (tidak menyetujui, tidak berjanji bayar, identitas AI jelas).
6. Statistik/testimoni/harga: **dihilangkan** sampai ada data nyata.
7. Footer: wordmark, tautan utama, kontak. Bahasa Indonesia.

---

## 12. Copywriting & panduan konten

Semua teks berasal dari produk nyata (SUPPLIO.md). Tidak ada slogan, statistik, kemitraan, atau testimoni rekaan.

### 12.1 Suara & nada

- **Bahasa Indonesia** baku-santai: "Anda" (bukan "kamu"/"lo"), kalimat pendek, kata kerja aktif.
- Tenang, jelas, transparan; tidak hiperbola. Hindari kata kosong ("revolusioner", "canggih", "terdepan", "seamless", "powerful").
- Selalu tegaskan peran pemilik di titik keputusan: AI **menyarankan**, pemilik **menyetujui**.
- Jangan menjanjikan hasil ("pasti hemat X%"); hanya jelaskan perilaku sistem.

### 12.2 Terminologi baku

Pakai persis istilah SUPPLIO.md §2 di UI: **Restock Budget**, **Maximum Unit Price**, **Current Stock**, **Incoming Quantity**, **Inventory Position**, **Daily Consumption**, **Manual Threshold**, **Planned Lead Time**, **Safety Stock**, **Target Coverage**, **Reorder Point**, **Target Stock**, **Required Quantity**, **Quotation**, **Final Approval**. Istilah teknis tetap dalam bahasa Inggris seperti baku proyek; penjelasan di sekitarnya dalam bahasa Indonesia, mis. label **Restock Budget** dengan bantuan "Batas total pengeluaran untuk satu procurement request, termasuk ongkir." Jangan menciptakan sinonim ("Anggaran belanja", "Stok minimum", dst.) untuk istilah yang sudah baku.

Nama menu & modul tetap: Dashboard, Inventory, Supplier, Procurement, Penerimaan, Pengaturan.

### 12.3 Pola penulisan

| Elemen | Aturan | Contoh |
|---|---|---|
| Judul halaman | Nama modul, nomina singkat | "Procurement" |
| Subjudul | Satu kalimat nilai/fungsi | "Pantau permintaan penawaran, negosiasi supplier, dan rekomendasi pembelian." |
| Tombol | Kata kerja + objek | "Minta penawaran", "Setujui pembelian", "Hubungkan Telegram", "Simpan perubahan" |
| Konfirmasi berisiko | Sebut akibat nyata | "Setujui & buat 2 purchase order senilai Rp 4.350.000?" |
| Galat | Apa yang salah + cara memperbaiki, tanpa menyalahkan | "Kata sandi belum sesuai. Periksa kembali lalu coba lagi." |
| Empty state | Apa ini + langkah berikut | "Belum ada supplier. Tambahkan supplier pertama untuk mulai meminta penawaran." |
| Status AI | Nyatakan keadaan sebenarnya | "Menunggu balasan supplier (batas 20 menit)" |
| Data demo | Selalu berlabel | "Data simulasi" |

### 12.4 Contoh CTA yang valid (berdasar fitur nyata)

"Masuk" · "Minta penawaran" · "Tambah supplier" · "Hubungkan Telegram" · "Lihat rekomendasi" · "Setujui pembelian" · "Tolak" · "Catat penerimaan" · "Simpan pengaturan".

### 12.5 Format

- Rupiah `Rp 1.250.000`; tanggal `13 Nov 2026`, waktu 24 jam `Asia/Jakarta` (`14.30 WIB`); kuantitas dengan satuan produk (`25 kg`); desimal koma (`2,5 kg`).
- Kode status teknis (`NO_FEASIBLE_SOLUTION`, `CONFIGURATION_REQUIRED`) **tidak** ditampilkan mentah ke pemilik; terjemahkan menjadi kalimat yang menjelaskan sebab dan langkah berikutnya (kode boleh muncul di detail/log).

---

## 13. Panduan responsif

### 13.1 Breakpoint (Tailwind)

| Nama | Lebar | Perilaku |
|---|---|---|
| mobile | < 640 px | 4 kolom, gutter 16 px |
| `sm` | ≥ 640 px | Margin 24 px |
| `md` (tablet) | ≥ 768 px | 8 kolom, gutter 16–24 px |
| `lg` (desktop) | ≥ 1024 px | 12 kolom, gutter 24 px, margin 40 px |
| `xl` | ≥ 1280 px | Lebar maks tercapai, konten terpusat |

### 13.2 Aturan per perangkat

| Aspek | Mobile | Tablet | Desktop |
|---|---|---|---|
| Navigasi | `Icon.svg` + tombol Menu → panel penuh; tautan 48 px | Wordmark + menu ringkas/sidebar ciut | Wordmark + menu horizontal/sidebar penuh |
| Layout | Satu kolom; panel samping turun di bawah konten utama | 2 kolom untuk panel sederhana, selebihnya satu | 8/4 atau 7/5 asimetris |
| Kartu | Bertumpuk, lebar penuh | Grid 2 kolom | Grid bento beragam ukuran |
| Tabel | Jadi daftar kartu **atau** scroll horizontal + kolom pertama sticky | Scroll horizontal bila perlu | Penuh |
| Tipografi | `clamp()` mengecilkan judul; isi tetap 16 px | idem | skala penuh |
| Spasi bagian | 48 px | 64 px | 96 px |
| Dekorasi | Bentuk dekoratif diperkecil/dikurangi menjadi 1; tidak ada bleed | Bleed ≤ 24 px | Bleed ≤ 48 px |
| Tombol | Aksi utama lebar penuh (sticky di bawah pada form panjang / halaman Approve) | Auto | Auto |
| Modal | Bottom-sheet | Dialog tengah | Dialog tengah |

Bukan sekadar mengecilkan desktop: urutan konten, bentuk komponen, dan elemen yang ditampilkan berubah (contoh: tabel → kartu, panel samping → bagian bawah, wordmark → ikon).

### 13.3 Aturan tak boleh dilanggar

- Tidak ada scroll horizontal pada halaman (kecuali wadah tabel yang sengaja bergulir).
- Elemen dekoratif memakai `overflow: clip` pada pembungkus seksi agar tidak melebar.
- Gambar/mockup `max-width: 100%; height: auto`.
- Uji di 360 px, 390 px, 768 px, 1024 px, 1440 px.

---

## 14. Aksesibilitas

Target minimum **WCAG 2.2 AA**.

1. **Kontras:** teks isi ≥ 4.5 : 1, teks besar (≥ 24 px atau ≥ 18.66 px bold) dan komponen UI/ikon informatif ≥ 3 : 1. Kombinasi pada §3.6 sudah diverifikasi. **Vibrant Pink tidak untuk teks/garis informatif di atas terang.**
2. **Fokus terlihat:** setiap elemen interaktif memiliki `:focus-visible` jelas (outline 2 px `--blue-700`, offset 2 px, plus `--ring-focus`). Jangan `outline: none` tanpa pengganti. Pada latar biru gunakan outline putih.
3. **Keadaan interaktif lengkap:** hover, focus, active, disabled, loading, error (§9).
4. **Tidak mengandalkan warna saja:** status = warna + ikon + teks; galat = border + ikon + pesan; grafik = label/pola.
5. **Ukuran:** isi minimal 16 px (tabel/metadata minimal 14 px, caption minimal 12 px dan bukan untuk informasi kritis).
6. **Target sentuh:** minimal 44 × 44 px, jarak antar target minimal 8 px.
7. **Semantik:** satu `h1` per halaman, hierarki heading berurutan; `<header>`, `<nav aria-label>`, `<main>`, `<footer>`; tabel dengan `<th scope>`; daftar sebagai `<ul>`; tombol = `<button>`, tautan = `<a>`.
8. **Form:** setiap field punya `<label for>` terlihat; pesan galat terhubung via `aria-describedby`, `role="alert"` untuk galat setelah submit; jangan hanya placeholder; `autocomplete` sesuai (`email`, `current-password`) seperti pada halaman login sekarang.
9. **Keyboard:** semua fungsi dapat dioperasikan tanpa mouse; urutan tab logis; modal mengunci fokus dan mengembalikannya; menu/tab mendukung panah dan Esc; sediakan *skip link* "Lewati ke konten".
10. **Gerak:** hormati `prefers-reduced-motion`; tak ada animasi berkedip > 3×/detik.
11. **Bahasa & konten:** `<html lang="id">` (sudah ada); logo punya `alt` yang sesuai (§2.6); status asinkron diumumkan lewat `aria-live="polite"`.
12. **Tindakan berisiko:** konfirmasi eksplisit dengan akibat yang dapat dibaca pembaca layar (Approve, Reject, hapus).

---

## 15. Do's & Don'ts

| ✅ Lakukan | ❌ Jangan |
|---|---|
| Pakai `Icon.svg`/`Text.svg` apa adanya, sesuai §2 | Menggambar ulang, mewarnai ulang, meregangkan, memberi efek, atau mengganti logo dengan teks/emoji/ikon generik |
| Soft White sebagai latar dominan, Deep Blue untuk struktur & aksi utama | Memakai latar putih murni di mana-mana atau warna dominan baru (hijau, oranye, ungu, dll.) |
| Satu sorotan merah muda per area pandang | Menaburkan merah muda di seluruh antarmuka; memakai merah muda untuk teks isi atau tombol utama |
| Judul besar, rapat, bobot 800; isi 16 px lega | Judul kecil bertabrakan dengan isi; lebih dari 4 bobot font |
| Layout asimetris (7/5, 8/4) dengan banyak ruang | Susunan kartu sama-besar berulang tanpa fokus; layout padat |
| Status AI terlihat: ikon + teks + warna | Menyembunyikan proses AI; status hanya berupa warna |
| Gunakan istilah baku SUPPLIO.md §2 | Membuat sinonim ("Anggaran", "Stok minimum") |
| Tandai data demo "Data simulasi" | Menampilkan angka penghematan/statistik/testimoni rekaan |
| Bayangan lembut berwarna biru, gradien dari palet | Bayangan hitam pekat, gradien pelangi, efek neon |
| Radius konsisten (§7); pil hanya untuk label & CTA hero | Membuat semuanya pil; radius acak per komponen |
| Ikon lucide 1.75 px, satu pustaka | Mencampur beberapa pustaka ikon; emoji di UI |
| Visual yang relevan produk (mockup, kotak paket 3D lembut) | Ilustrasi 3D acak hanya sebagai pengisi |
| Konfirmasi eksplisit untuk Approve/Reject/hapus | Tombol "OK"/"Ya" tanpa menyebut akibat |
| Uji kontras & fokus keyboard | Menghapus outline fokus |
| Ubah gaya lewat token CSS & varian CVA | Menyalin ulang komponen UI atau memakai hex langsung di komponen |

---

## 16. Panduan implementasi

### 16.1 Urutan penerapan yang disarankan (saat dikerjakan, bukan sekarang)

1. **Token:** ganti blok `:root` di `src/app/globals.css` dengan §3.7 + tambahkan variabel bayangan/gradien §8; `--radius: 0.75rem`.
2. **Font:** ganti Geist Sans dengan Plus Jakarta Sans di `src/app/layout.tsx` (pertahankan Geist Mono); atur `--font-sans`.
3. **Aset brand:** salin ke `public/brand/` (tanpa modifikasi); ganti teks "Supplio" di header dengan wordmark; buat favicon dari ikon.
4. **Komponen dasar** (`src/components/ui/*`): sesuaikan varian CVA (Button/Badge/Card/Input) ke spesifikasi §9; **tidak** membuat komponen paralel.
5. **Kerangka** (`src/app/(dashboard)/layout.tsx`): header sticky blur, nav aktif, menu mobile.
6. **Halaman** satu per satu: header halaman → ringkasan → konten (§11.1). Mulai dari Login dan Dashboard.
7. **Audit:** kontras, fokus, 5 lebar viewport, reduced motion.

### 16.2 Konvensi kode

- **Hanya token.** Warna, radius, bayangan, spasi dirujuk lewat variabel/utility Tailwind (`bg-primary`, `text-muted-foreground`, `rounded-lg`, `shadow-md`). Tidak ada hex/px liar di komponen.
- Daftarkan token baru (bayangan, gradien, status) di `@theme inline` agar tersedia sebagai utility, mis.:

```css
@theme inline {
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-pink: var(--pink-500);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
}
```

- Varian komponen lewat **CVA** (pola yang sudah dipakai `button.tsx`/`badge.tsx`); tambahkan varian `accent` pada Button dan varian `success`/`warning`/`info`/`brand` pada Badge.
- Gabungkan kelas dengan `cn` yang sudah ada. Ikon: `lucide-react`. Gambar: `next/image`.
- Format angka/rupiah/tanggal melalui satu helper presentasi (`Intl` `id-ID`, `Asia/Jakarta`), bukan di tiap komponen.
- Server Component secara default; komponen klien hanya untuk interaksi.

### 16.3 Contoh komponen acuan

**Kartu rekomendasi (target tampilan):**

```tsx
<section className="rounded-3xl border border-blue-300/60 bg-card p-8 shadow-md">
  <Badge variant="brand">Rekomendasi</Badge>
  <h3 className="mt-4 text-xl font-bold tracking-tight">Pembelian dari 2 supplier</h3>
  <p className="mt-1 text-sm text-muted-foreground">Total terendah yang memenuhi kebutuhan dan Restock Budget.</p>
  <p className="stat mt-6 tabular-nums">Rp 4.350.000</p>
  <p className="text-sm text-muted-foreground">Sisa budget Rp 650.000 · termasuk ongkir</p>
  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
    <Button variant="outline">Tolak</Button>
    <Button size="lg">Setujui pembelian</Button>
  </div>
</section>
```

*(Angka di atas hanya contoh tata letak, bukan data produk.)*

**Header halaman:**

```tsx
<header className="relative overflow-clip rounded-3xl bg-[image:var(--grad-wash)] px-6 py-10 md:px-10">
  <p className="overline text-blue-700">PROCUREMENT</p>
  <h1 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.03em]">
    Permintaan <span className="text-pink-500">penawaran</span>
  </h1>
  <p className="mt-3 max-w-[68ch] text-lg text-muted-foreground">
    Pantau negosiasi supplier dan setujui rekomendasi pembelian.
  </p>
</header>
```

### 16.4 Daftar periksa sebelum menyatakan halaman "selesai"

- [ ] Hanya token (tanpa hex/px liar); utility sesuai skala §6/§7.
- [ ] Logo dari aset asli, ukuran & clear space sesuai §2.
- [ ] Tidak lebih dari satu sorotan merah muda per viewport.
- [ ] Istilah sesuai SUPPLIO.md §2; teks Indonesia; data demo berlabel.
- [ ] Status memakai ikon + teks; semua keadaan interaktif ada.
- [ ] Fokus keyboard terlihat; kontras lulus; target sentuh ≥ 44 px.
- [ ] Diuji di 360 / 768 / 1024 / 1440 px tanpa scroll horizontal.
- [ ] `prefers-reduced-motion` dihormati.
- [ ] Tidak ada angka, klaim, atau testimoni yang tidak bersumber dari sistem.

---

*Dokumen ini hanya menetapkan arah visual dan aturan implementasi. Perubahan pada token, aset, atau terminologi harus diperbarui di sini dan di SUPPLIO.md bila menyangkut istilah produk.*
