-- Konfirmasi owner atas chat Telegram supplier (SUPPLIO.md §5): chat yang menyetujui tombol di Telegram
-- belum terverifikasi sampai owner menekan Konfirmasi di dashboard. Kolom pending terpisah dari kolom
-- terverifikasi, sehingga koneksi lama tetap berlaku sampai chat baru dikonfirmasi.
-- Tabel Supplier sudah ENABLE ROW LEVEL SECURITY; kolom baru tidak mengubah kebijakan itu.
ALTER TABLE "Supplier"
  ADD COLUMN "telegramPendingChatId"   BIGINT,
  ADD COLUMN "telegramPendingUserId"   BIGINT,
  ADD COLUMN "telegramPendingName"     TEXT,
  ADD COLUMN "telegramPendingUsername" TEXT,
  ADD COLUMN "telegramPendingAt"       TIMESTAMP(3);

CREATE UNIQUE INDEX "Supplier_telegramPendingChatId_key" ON "Supplier"("telegramPendingChatId");
