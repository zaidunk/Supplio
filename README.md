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

## Skrip

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit test (cepat, tanpa database; OpenAI & Telegram selalu di-mock) |
| `npm run test:integration` | Integration test ke database sungguhan (`DATABASE_URL`). Memakai bisnis uji terisolasi (`ownerUserId` berawalan `itest-`) yang dihapus setelahnya; data demo tidak disentuh |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:seed` | Seed demo (idempotent) |

## Catatan migrasi

`prisma/migrations/*_partial_unique_indexes` berisi unique index parsial dan CHECK constraint
(satu request aktif per bisnis, satu sesi aktif per supplier, maksimal satu counter-offer, dsb.)
yang tidak bisa dinyatakan di `schema.prisma`. Jangan dihapus. Untuk perubahan schema berikutnya
buat migrasi dengan `prisma migrate dev` seperti biasa.
