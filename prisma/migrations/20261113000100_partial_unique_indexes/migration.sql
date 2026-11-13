-- Aturan yang tidak dapat dinyatakan di schema.prisma. Ditulis manual; jangan hapus.

-- §4.1: satu proses sourcing aktif per bisnis (MVP).
-- "Aktif" = belum mencapai status akhir/penyelesaian.
CREATE UNIQUE INDEX "ProcurementRequest_one_active_per_business"
  ON "ProcurementRequest" ("businessId")
  WHERE "status" IN (
    'DRAFT', 'SOURCING', 'AWAITING_RESPONSES', 'OPTIMIZING',
    'AWAITING_APPROVAL', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'
  );

-- §5: satu sesi negosiasi aktif per supplier (chat) agar balasan tidak salah konteks.
CREATE UNIQUE INDEX "NegotiationSession_one_active_per_supplier"
  ON "NegotiationSession" ("supplierId")
  WHERE "status" IN ('CONTACTED', 'AWAITING_REPLY', 'CLARIFYING', 'NEGOTIATING');

-- §1.2: maksimal satu counter-offer per supplier per request (lapis kedua di luar kode).
ALTER TABLE "NegotiationSession"
  ADD CONSTRAINT "NegotiationSession_round_max_one" CHECK ("negotiationRound" BETWEEN 0 AND 1);

-- §2: restockBudget > 0 (integer IDR). Pengecualian: CONFIGURATION_REQUIRED (budget belum diset, tanpa AI).
ALTER TABLE "ProcurementRequest"
  ADD CONSTRAINT "ProcurementRequest_restockBudget_positive"
  CHECK ("status" = 'CONFIGURATION_REQUIRED' OR "restockBudget" > 0);

ALTER TABLE "Business"
  ADD CONSTRAINT "Business_defaultRestockBudget_nonneg" CHECK ("defaultRestockBudget" >= 0);

-- Stok tidak boleh negatif; kuantitas penting tidak boleh negatif/nol bila bermakna.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_currentStock_nonneg" CHECK ("currentStock" >= 0),
  ADD CONSTRAINT "Product_allowedOverbuy_nonneg" CHECK ("allowedOverbuyQuantity" >= 0),
  ADD CONSTRAINT "Product_maximumUnitPrice_positive" CHECK ("maximumUnitPrice" IS NULL OR "maximumUnitPrice" > 0);

ALTER TABLE "ProcurementRequestItem"
  ADD CONSTRAINT "ProcurementRequestItem_requiredQuantity_positive" CHECK ("requiredQuantity" > 0);

ALTER TABLE "PurchaseOrderItem"
  ADD CONSTRAINT "PurchaseOrderItem_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "GoodsReceiptItem"
  ADD CONSTRAINT "GoodsReceiptItem_receivedQuantity_positive" CHECK ("receivedQuantity" > 0);

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_quantity_sign" CHECK (
    ("type" = 'ADJUSTMENT' AND "quantity" <> 0) OR ("type" <> 'ADJUSTMENT' AND "quantity" > 0)
  );
