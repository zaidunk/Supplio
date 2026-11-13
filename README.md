# Supplio

AI-assisted inventory & procurement untuk UMKM kuliner. Sumber kebenaran produk: [SUPPLIO.md](SUPPLIO.md).

## Setup lokal

1. `npm install` (otomatis menjalankan `prisma generate`)
2. Salin `.env.example` ke `.env.local` dan isi nilainya.
3. Buat satu user owner di Supabase Auth (Dashboard → Authentication → Users).
4. Terapkan migrasi: `npm run db:migrate`
5. (Opsional) Isi data demo: isi `SEED_OWNER_USER_ID` dengan UUID user tadi, lalu `npm run db:seed`.
   Seluruh data seed adalah **simulasi**.
6. `npm run dev`

## Telegram & Inngest

Supplier adalah manusia yang membalas lewat **Telegram Bot API** (bukan akun personal pemilik).

1. Buat bot di [@BotFather](https://t.me/BotFather). Isi `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_BOT_USERNAME` (tanpa `@`) di `.env.local`.
2. Buat secret webhook acak untuk `TELEGRAM_WEBHOOK_SECRET`:
   `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
3. Telegram butuh URL **HTTPS publik**. Saat dev lokal, ekspos port 3000 lewat tunnel (cloudflared/ngrok), lalu:
   `npm run telegram:webhook -- set https://url-tunnel-anda.example`
   Cek dengan `npm run telegram:webhook -- info` (juga menampilkan username bot).
4. Alur onboarding supplier: halaman **Supplier** → *Hubungkan Telegram* → kirim tautan ke supplier → supplier membuka tautan,
   menekan Start, lalu menekan tombol persetujuan. Tautan sekali pakai dan kedaluwarsa (`TELEGRAM_LINK_TOKEN_TTL_HOURS`).
   Bot tidak bisa memulai chat sebelum supplier melakukan langkah ini.
5. **Inngest** menjalankan outreach, penantian balasan (timeout `responseTimeoutMinutes`), dan optimasi. Lokal:
   `npx inngest-cli@latest dev` lalu jalankan app dengan `INNGEST_DEV=1`. Produksi: `INNGEST_EVENT_KEY` dan `INNGEST_SIGNING_KEY`.
   Tanpa Inngest, pesan Telegram tetap diproses lewat jalur cadangan, tetapi sourcing otomatis tidak berjalan.

Pesan di webhook hanya disimpan lalu dijawab 2xx; pemrosesan berjalan terpisah dan idempotent (deduplikasi `update_id`).

## Agen AI (Gemini)

Balasan supplier diproses satu per satu oleh agen LangChain.js (`src/lib/ai/`), dijalankan Inngest, bukan di webhook.
LLM: Google Gemini (`GEMINI_API_KEY`, `GEMINI_MODEL`, default `gemini-2.5-flash`).

- **Model hanya memahami bahasa dan menyusun pesan.** Aturan keselamatan ditegakkan KODE: maksimal satu counter-offer per
  supplier (juga CHECK di database), batas klarifikasi dan jumlah pesan, satu pesan per giliran, penjaga pesan keluar
  (budget, harga maksimum, nama supplier lain, komitmen pembelian, tautan), serta status penawaran dan sesi.
- Tool yang tersedia hanya `getProcurementContext`, `getEligibleSuppliers`, `getConversationHistory`, `saveQuotation`,
  `sendSupplierMessage`; semuanya terikat `businessId`/`requestId`/`sessionId` dari backend. Tidak ada tool untuk
  menyetujui pembelian atau mengubah budget.
- Pesan supplier adalah data tidak tepercaya (dibungkus `<supplier_message>` dan di-escape). Data yang tidak tegas
  ("sekitar 17 ribu") menjadi `NEEDS_CLARIFICATION` dan tidak pernah masuk optimasi.
- **Kuota:** Free Tier Gemini hanya 5 permintaan/menit/model, dan satu giliran memakai 2-4 panggilan. Saat 429, Inngest
  menunggu sesuai petunjuk Google lalu mengulang (giliran idempoten). Untuk beberapa supplier sekaligus gunakan tier berbayar.
- Tes memakai model palsu (`npm test`, `npm run test:integration`). `npm run test:live` memanggil Gemini sungguhan
  (3 skenario, beberapa panggilan); jalankan seperlunya agar tidak menghabiskan kuota.

## Skrip

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit test (cepat, tanpa database; OpenAI & Telegram selalu di-mock) |
| `npm run test:integration` | Integration test ke database sungguhan (`DATABASE_URL`). Memakai bisnis uji terisolasi (`ownerUserId` berawalan `itest-`) yang dihapus setelahnya; data demo tidak disentuh |
| `npm run test:live` | Opt-in: 3 skenario agen ke Gemini sungguhan (memakai kuota API; jangan sering dijalankan) |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:seed` | Seed demo (idempotent) |
| `npm run telegram:webhook -- info\|set <https-url>\|delete` | Kelola webhook bot Telegram |

## Catatan migrasi

`prisma/migrations/*_partial_unique_indexes` berisi unique index parsial dan CHECK constraint
(satu request aktif per bisnis, satu sesi aktif per supplier, maksimal satu counter-offer, dsb.)
yang tidak bisa dinyatakan di `schema.prisma`. Jangan dihapus. Untuk perubahan schema berikutnya
buat migrasi dengan `prisma migrate dev` seperti biasa.
