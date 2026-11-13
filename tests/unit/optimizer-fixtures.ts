import type {
  OptimizerInput,
  OptimizerQuotation,
  OptimizerQuotationItem,
  OptimizerRequestItem,
} from "@/lib/optimization/types";

export const NOW = new Date("2026-11-13T05:00:00Z");

export const item = (o: Partial<OptimizerRequestItem> & { productId: string }): OptimizerRequestItem => ({
  productName: o.productId,
  unit: "kg",
  quantityScale: 0,
  requiredQuantity: "10",
  allowedOverbuyQuantity: "0",
  maxDeliveryDays: 3,
  maximumUnitPrice: null,
  ...o,
});

export const qi = (
  id: string,
  productId: string,
  price: number,
  o: Partial<OptimizerQuotationItem> = {},
): OptimizerQuotationItem => ({
  quotationItemId: id,
  productId,
  quotedUnitPrice: price,
  availableQuantity: "100",
  minimumOrderQuantity: "1",
  packSize: null,
  ...o,
});

export const quote = (
  supplierId: string,
  items: OptimizerQuotationItem[],
  o: Partial<OptimizerQuotation> = {},
): OptimizerQuotation => ({
  quotationId: `q-${supplierId}`,
  supplierId,
  supplierName: `Supplier ${supplierId}`,
  status: "CONFIRMED",
  shippingFee: 0,
  leadTimeDays: 1,
  validUntil: null,
  items,
  ...o,
});

export const makeInput = (o: Partial<OptimizerInput> = {}): OptimizerInput => ({
  restockBudget: 10_000_000,
  items: [],
  quotations: [],
  now: NOW,
  ...o,
});
