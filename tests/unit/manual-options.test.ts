import { describe, expect, it } from "vitest";
import { buildManualHints } from "@/lib/procurement/manual-options";
import type { RequestDetail } from "@/lib/procurement/queries";

type Item = RequestDetail["items"][number];
type Session = RequestDetail["sessions"][number];

const item = (over: Partial<Item> = {}): Item => ({
  productId: "p1",
  productName: "Gula Pasir",
  unit: "kg",
  requiredQuantity: "33.000",
  maxDeliveryDays: 2,
  allowedOverbuyQuantity: "0",
  stockoutRisk: false,
  daysOfCover: null,
  ...over,
});

const session = (supplierName: string, leadTimeDays: number | null, available: string | null, status: "CONFIRMED" | "REJECTED" = "CONFIRMED"): Session => ({
  id: supplierName,
  supplierName,
  status: "CONFIRMED",
  negotiationRound: 0,
  expiresAt: null,
  messages: [],
  quotations: [
    {
      id: `${supplierName}-q`,
      status,
      shippingFee: 0,
      leadTimeDays,
      items: [{ productName: "Gula Pasir", unit: "kg", quotedUnitPrice: 1000, availableQuantity: available, minimumOrderQuantity: "1", packSize: null }],
    },
  ],
});

describe("buildManualHints (NO_FEASIBLE_SOLUTION)", () => {
  it("menyarankan batas kedatangan baru bila stok cukup tetapi lead time melewati batas", () => {
    const [h] = buildManualHints([item()], [session("Supplier B", 5, "35.000")]);
    expect(h.suggestedMaxDeliveryDays).toBe(5);
    expect(h.availableInTime).toBe(0);
    expect(h.shortfall).toBe(0);
    expect(h.messages[0]).toContain("5 hari");
    expect(h.messages[0]).toContain("Supplier B");
  });

  it("melaporkan kekurangan stok bila semua penawaran tidak cukup", () => {
    const [h] = buildManualHints([item({ productName: "Gula Pasir" })], [session("Supplier A", 1, "10.000")]);
    expect(h.suggestedMaxDeliveryDays).toBeNull();
    expect(h.shortfall).toBe(23);
    expect(h.messages[0]).toContain("kurang 23 kg");
  });

  it("menjumlahkan stok antar supplier sebelum menyarankan batas baru", () => {
    const [h] = buildManualHints([item()], [session("A", 1, "20.000"), session("B", 4, "20.000")]);
    expect(h.availableInTime).toBe(20);
    expect(h.suggestedMaxDeliveryDays).toBe(4);
  });

  it("mengabaikan penawaran yang tidak CONFIRMED dan melaporkan bila tidak ada penawaran", () => {
    const [h] = buildManualHints([item()], [session("A", 1, "99.000", "REJECTED")]);
    expect(h.messages[0]).toContain("Belum ada penawaran terkonfirmasi");
  });

  it("stok tepat waktu cukup: penyebab bukan lead time/stok", () => {
    const [h] = buildManualHints([item()], [session("A", 1, "40.000")]);
    expect(h.suggestedMaxDeliveryDays).toBeNull();
    expect(h.messages[0]).toContain("Restock Budget");
  });

  it("stok tidak disebutkan dianggap tidak membatasi", () => {
    const [h] = buildManualHints([item()], [session("A", 1, null)]);
    expect(h.messages[0]).toContain("Restock Budget");
  });
});
