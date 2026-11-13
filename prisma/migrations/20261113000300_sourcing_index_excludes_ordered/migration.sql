-- Koreksi SUPPLIO.md §4.1: yang dibatasi satu per bisnis adalah proses SOURCING aktif.
-- Setelah PO dibuat (ORDERED) / sebagian diterima, sourcing sudah selesai: kebutuhan tercakup oleh
-- incomingQuantity dari PO outstanding, sehingga bisnis tetap boleh memulai sourcing baru untuk barang lain.
DROP INDEX "ProcurementRequest_one_active_per_business";

CREATE UNIQUE INDEX "ProcurementRequest_one_active_per_business"
  ON "ProcurementRequest" ("businessId")
  WHERE "status" IN (
    'DRAFT', 'SOURCING', 'AWAITING_RESPONSES', 'OPTIMIZING',
    'AWAITING_APPROVAL', 'APPROVED'
  );
