-- Permintaan penawaran manual oleh owner (SUPPLIO.md §4.1): bedakan request otomatis dan manual.
-- Tabel ProcurementRequest sudah ENABLE ROW LEVEL SECURITY; kolom baru tidak mengubah kebijakan itu.
CREATE TYPE "TriggerSource" AS ENUM ('AUTO', 'MANUAL');

ALTER TABLE "ProcurementRequest"
  ADD COLUMN "triggerSource" "TriggerSource" NOT NULL DEFAULT 'AUTO';
