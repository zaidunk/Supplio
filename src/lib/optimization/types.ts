import type { QuotationStatus } from "@/generated/prisma/enums";

/**
 * Masukan optimizer = DATA TERVALIDASI (bukan keluaran LLM mentah). Kuantitas berupa string desimal;
 * uang berupa integer IDR dalam satuan dasar produk (SUPPLIO.md §2).
 */
export interface OptimizerRequestItem {
  productId: string;
  productName: string;
  unit: string;
  /** Jumlah desimal yang diizinkan untuk satuan produk; menentukan langkah pembelian terkecil. */
  quantityScale: number;
  requiredQuantity: string;
  /** Snapshot dari request; default "0". */
  allowedOverbuyQuantity: string;
  maxDeliveryDays: number;
  /** Batas harga beli per satuan dasar; null = tidak ada batas. */
  maximumUnitPrice: number | null;
}

export interface OptimizerQuotationItem {
  quotationItemId: string;
  productId: string;
  /** IDR per satuan dasar produk (sudah dinormalisasi dari kemasan). */
  quotedUnitPrice: number;
  availableQuantity: string | null;
  minimumOrderQuantity: string;
  packSize: string | null;
}

export interface OptimizerQuotation {
  quotationId: string;
  supplierId: string;
  supplierName: string;
  status: QuotationStatus;
  /** Ongkir hasil quotation final; null = belum jelas (penawaran tidak boleh dipakai). */
  shippingFee: number | null;
  leadTimeDays: number | null;
  validUntil: Date | null;
  items: OptimizerQuotationItem[];
}

export interface OptimizerInput {
  restockBudget: number;
  items: OptimizerRequestItem[];
  /** Maksimal satu penawaran per supplier (penawaran final terbaru). */
  quotations: OptimizerQuotation[];
  now: Date;
}

export type RejectionReason =
  | "QUOTATION_NOT_CONFIRMED"
  | "QUOTATION_EXPIRED"
  | "SHIPPING_FEE_UNKNOWN"
  | "LEAD_TIME_UNKNOWN"
  | "LEAD_TIME_TOO_LONG"
  | "PRICE_ABOVE_MAXIMUM"
  | "AVAILABLE_QUANTITY_UNKNOWN"
  | "OUT_OF_STOCK"
  | "MOQ_OR_PACK_EXCEEDS_LIMIT"
  | "INVALID_DATA";

export interface IneligibleOffer {
  quotationId: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  reason: RejectionReason;
  detail: string;
}

/** Satu baris pembelian yang diusulkan (belum dihitung harganya). */
export interface ProposedLine {
  quotationItemId: string;
  quantity: string;
}

export interface PricedLine {
  quotationItemId: string;
  quotationId: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: string;
  unitPrice: number;
  /** ceil(unitPrice × quantity), integer IDR. */
  lineCost: number;
}

export interface SupplierCost {
  supplierId: string;
  supplierName: string;
  /** Dihitung SEKALI per supplier yang dipakai. */
  shippingFee: number;
  itemsCost: number;
  leadTimeDays: number;
}

export interface Totals {
  lines: PricedLine[];
  suppliers: SupplierCost[];
  itemsCost: number;
  shippingCost: number;
  totalCost: number;
}

export interface Violation {
  code: string;
  message: string;
  productId?: string;
  supplierId?: string;
}

export type InfeasibilityReason =
  | { code: "NO_QUOTATIONS"; message: string }
  | { code: "NO_ELIGIBLE_OFFER"; productId: string; productName: string; message: string }
  | {
      code: "INSUFFICIENT_SUPPLY";
      productId: string;
      productName: string;
      required: string;
      maxCoverable: string;
      message: string;
    }
  | { code: "COVERAGE_IMPOSSIBLE"; message: string }
  | { code: "BUDGET_EXCEEDED"; minimumTotalCost: number; restockBudget: number; shortfall: number; message: string };

export type OptimizerResult =
  | ({
      status: "OPTIMAL";
      remainingBudget: number;
      explanationLines: string[];
      ineligible: IneligibleOffer[];
    } & Totals)
  | {
      status: "NO_FEASIBLE_SOLUTION";
      reasons: InfeasibilityReason[];
      explanationLines: string[];
      ineligible: IneligibleOffer[];
    }
  | { status: "ERROR"; message: string; violations?: Violation[] };
