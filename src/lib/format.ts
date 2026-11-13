/** Format presentasi (§2: format rupiah hanya di lapisan presentasi; zona waktu Asia/Jakarta). */
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export const formatRupiah = (amount: number): string => rupiah.format(amount);

/** "12.000" → "12", "0.600" → "0.6". */
export const formatQty = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return "-";
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
};

export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));
