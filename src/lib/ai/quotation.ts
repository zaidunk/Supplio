import Decimal from "decimal.js";
import { z } from "zod";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";

/**
 * Ekstraksi penawaran (SUPPLIO.md §3.2, §6, §13). Keluaran model = TIDAK TEPERCAYA: harus lolos skema Zod,
 * normalisasi satuan, dan aturan kelengkapan sebelum menjadi data tervalidasi yang boleh masuk solver.
 * Prinsip: tidak ada nilai yang ditebak. Data yang tidak tegas → NEEDS_CLARIFICATION, bukan CONFIRMED.
 */
export const saveQuotationSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().describe("productId PERSIS seperti pada konteks; jangan membuat id sendiri."),
        unitPrice: z
          .number()
          .optional()
          .describe("Harga dalam rupiah penuh (mis. 16500, bukan 16.5). Kosongkan bila supplier belum menyebut angka tegas."),
        priceBasis: z
          .enum(["PER_BASE_UNIT", "PER_PACK"])
          .optional()
          .describe("PER_BASE_UNIT bila harga per satuan dasar produk (kg/liter/...). PER_PACK bila harga per kemasan/dus (isi packSize)."),
        packSize: z
          .number()
          .optional()
          .describe("Isi satu kemasan dalam satuan dasar (mis. 12 liter per dus). Wajib bila priceBasis=PER_PACK; bila ada, pembelian dalam kelipatan ini."),
        availableQuantity: z.number().optional().describe("Stok tersedia (satuan dasar) yang disebut supplier."),
        minimumOrderQuantity: z
          .number()
          .optional()
          .describe("Minimum order (satuan dasar). Isi 1 HANYA bila supplier jelas menyatakan tidak ada minimum; kosongkan bila tidak disebut."),
      }),
    )
    .optional(),
  shippingFee: z.number().optional().describe("Ongkos kirim total (rupiah). Isi 0 HANYA bila supplier jelas menyatakan gratis ongkir."),
  leadTimeDays: z.number().optional().describe("Estimasi waktu kirim dalam hari."),
  validUntil: z.string().optional().describe("Batas berlaku penawaran (tanggal ISO, mis. 2026-11-20) bila disebut."),
  unavailableProductIds: z.array(z.string()).optional().describe("productId yang supplier nyatakan tidak tersedia/tidak dijual."),
  supplierDeclinedAll: z.boolean().optional().describe("true bila supplier menolak/tidak bisa memasok SEMUA barang yang diminta."),
  unclearPoints: z
    .array(z.string())
    .optional()
    .describe('Hal yang disebut supplier tetapi tidak tegas, mis. "harga \'sekitar 17 ribu\' tidak pasti", "satuan tidak disebut".'),
});

export type SaveQuotationInput = z.infer<typeof saveQuotationSchema>;

export interface ContextProduct {
  productId: string;
  productName: string;
  unit: string;
  quantityScale: number;
}

export interface NormalizedItem {
  productId: string;
  quotedUnitPrice: number;
  availableQuantity: string;
  minimumOrderQuantity: string;
  packSize: string | null;
}

export type QuotationEvaluation =
  | { status: "DECLINED" }
  | { status: "NEEDS_CLARIFICATION"; missing: string[] }
  | {
      status: "CONFIRMED";
      items: NormalizedItem[];
      shippingFee: number;
      leadTimeDays: number;
      validUntil: Date | null;
      declinedProductIds: string[];
    };

const MAX_POINT_LENGTH = 140;
const fits3Decimals = (n: number) => Number.isFinite(n) && new Decimal(n).decimalPlaces() <= 3;

/**
 * Menilai masukan model terhadap produk yang memang diminta dan disuplai supplier ini.
 * Murni (tanpa DB) sehingga dapat diuji menyeluruh.
 */
export function evaluateQuotation(input: SaveQuotationInput, products: ContextProduct[], now: Date): QuotationEvaluation {
  if (input.supplierDeclinedAll === true) return { status: "DECLINED" };

  const known = new Set(products.map((p) => p.productId));
  const unavailable = new Set((input.unavailableProductIds ?? []).filter((id) => known.has(id)));

  // Semua barang dinyatakan tidak tersedia: tidak ada yang dibeli, jadi ongkir/lead time tidak relevan untuk ditanyakan.
  if (products.length > 0 && products.every((p) => unavailable.has(p.productId))) return { status: "DECLINED" };

  // productId karangan model / dari luar konteks diabaikan; duplikat ditandai.
  const byProduct = new Map<string, NonNullable<SaveQuotationInput["items"]>[number]>();
  const duplicates = new Set<string>();
  for (const raw of input.items ?? []) {
    if (!known.has(raw.productId)) continue;
    if (byProduct.has(raw.productId)) duplicates.add(raw.productId);
    byProduct.set(raw.productId, raw);
  }

  const missing: string[] = [];
  const items: NormalizedItem[] = [];

  for (const p of products) {
    if (unavailable.has(p.productId)) continue;
    const raw = byProduct.get(p.productId);
    const label = p.productName;
    if (!raw) {
      missing.push(`${label}: belum ada tanggapan (harga, stok, MOQ) atau konfirmasi bahwa tidak tersedia`);
      continue;
    }
    if (duplicates.has(p.productId)) missing.push(`${label}: data muncul lebih dari satu kali`);

    const problems: string[] = [];

    // Harga → integer IDR per satuan dasar
    let unitPrice: number | null = null;
    if (raw.unitPrice === undefined) {
      problems.push(`harga per ${p.unit}`);
    } else if (!Number.isFinite(raw.unitPrice) || raw.unitPrice <= 0) {
      problems.push("harga tidak valid");
    } else if (raw.priceBasis === "PER_PACK") {
      if (raw.packSize === undefined || !Number.isFinite(raw.packSize) || raw.packSize <= 0 || !fits3Decimals(raw.packSize)) {
        problems.push(`isi per kemasan (untuk menghitung harga per ${p.unit})`);
      } else {
        const perUnit = new Decimal(raw.unitPrice).div(raw.packSize);
        if (perUnit.isInteger()) unitPrice = perUnit.toNumber();
        else problems.push(`harga per kemasan tidak habis dibagi isi kemasan; minta harga per ${p.unit}`);
      }
    } else if (Number.isInteger(raw.unitPrice)) {
      unitPrice = raw.unitPrice;
    } else {
      problems.push(`harga per ${p.unit} harus rupiah utuh`);
    }

    if (raw.availableQuantity === undefined) problems.push("stok tersedia");
    else if (!Number.isFinite(raw.availableQuantity) || raw.availableQuantity < 0 || !fits3Decimals(raw.availableQuantity)) problems.push("stok tidak valid");

    if (raw.minimumOrderQuantity === undefined) problems.push("minimum order (MOQ)");
    else if (!Number.isFinite(raw.minimumOrderQuantity) || raw.minimumOrderQuantity < 0 || !fits3Decimals(raw.minimumOrderQuantity)) {
      problems.push("MOQ tidak valid");
    }

    const packSize = raw.packSize;
    if (packSize !== undefined && (!Number.isFinite(packSize) || packSize <= 0 || !fits3Decimals(packSize))) problems.push("isi kemasan tidak valid");

    if (problems.length > 0) {
      missing.push(`${label}: ${problems.join(", ")}`);
      continue;
    }
    items.push({
      productId: p.productId,
      quotedUnitPrice: unitPrice!,
      availableQuantity: new Decimal(raw.availableQuantity!).toString(),
      minimumOrderQuantity: new Decimal(raw.minimumOrderQuantity!).toString(),
      packSize: packSize === undefined ? null : new Decimal(packSize).toString(),
    });
  }

  // Ongkir dan lead time (berlaku untuk seluruh penawaran supplier ini)
  let shippingFee: number | null = null;
  if (input.shippingFee === undefined) missing.push("ongkos kirim");
  else if (!Number.isInteger(input.shippingFee) || input.shippingFee < 0) missing.push("ongkos kirim tidak valid");
  else shippingFee = input.shippingFee;

  let leadTimeDays: number | null = null;
  if (input.leadTimeDays === undefined) missing.push("lead time (estimasi hari kirim)");
  else if (!Number.isInteger(input.leadTimeDays) || input.leadTimeDays < 0 || input.leadTimeDays > 365) missing.push("lead time tidak valid");
  else leadTimeDays = input.leadTimeDays;

  let validUntil: Date | null = null;
  if (input.validUntil !== undefined && input.validUntil.trim() !== "") {
    const parsed = new Date(input.validUntil);
    if (Number.isNaN(parsed.getTime())) missing.push("masa berlaku penawaran tidak jelas");
    else if (parsed.getTime() <= now.getTime()) missing.push("masa berlaku penawaran sudah lewat");
    else validUntil = parsed;
  }

  for (const point of input.unclearPoints ?? []) {
    const text = point.replace(/\s+/g, " ").trim().slice(0, MAX_POINT_LENGTH);
    if (text) missing.push(`perlu ditegaskan: ${text}`);
  }

  if (missing.length > 0) return { status: "NEEDS_CLARIFICATION", missing };
  if (items.length === 0) return { status: "DECLINED" }; // semua produk dinyatakan tidak tersedia

  return {
    status: "CONFIRMED",
    items,
    shippingFee: shippingFee!,
    leadTimeDays: leadTimeDays!,
    validUntil,
    declinedProductIds: [...unavailable],
  };
}

export interface PersistedQuotation {
  quotationId: string;
  status: "CONFIRMED" | "NEEDS_CLARIFICATION" | "REJECTED";
  /** Hal yang masih perlu diklarifikasi (kosong bila CONFIRMED). */
  missing: string[];
}

/** Penawaran yang sudah dibuat dari pesan supplier tertentu (agar retry giliran yang sama tidak menggandakan data). */
export async function findQuotationForMessage(
  db: PrismaClient | Prisma.TransactionClient,
  sessionId: string,
  sourceMessageId: string,
): Promise<PersistedQuotation | null> {
  const found = await db.quotation.findFirst({
    where: { sessionId, rawExtraction: { path: ["sourceMessageId"], equals: sourceMessageId } },
    select: { id: true, status: true, rawExtraction: true },
  });
  if (!found) return null;
  const evaluation = (found.rawExtraction as { evaluation?: { missing?: unknown } } | null)?.evaluation;
  const missing = Array.isArray(evaluation?.missing) ? evaluation.missing.filter((m): m is string => typeof m === "string") : [];
  return { quotationId: found.id, status: found.status as PersistedQuotation["status"], missing };
}

/**
 * Simpan hasil penilaian. Hanya penawaran CONFIRMED yang membawa baris QuotationItem (nilai yang tidak tegas tidak
 * pernah disimpan sebagai angka). Penawaran lama yang belum final di sesi ini ditandai REJECTED (digantikan);
 * penawaran CONFIRMED sebelumnya tetap sah sampai ada yang lebih baru (loader optimasi memakai yang terbaru).
 */
export async function persistQuotation(
  db: PrismaClient,
  params: {
    sessionId: string;
    supplierId: string;
    sourceMessageId: string;
    input: SaveQuotationInput;
    evaluation: QuotationEvaluation;
    now: Date;
  },
): Promise<PersistedQuotation> {
  const existing = await findQuotationForMessage(db, params.sessionId, params.sourceMessageId);
  if (existing) return existing;

  const { evaluation } = params;
  const raw = {
    sourceMessageId: params.sourceMessageId,
    input: params.input,
    evaluation: evaluation.status === "NEEDS_CLARIFICATION" ? { status: evaluation.status, missing: evaluation.missing } : { status: evaluation.status },
  } as unknown as Prisma.InputJsonValue;

  return db.$transaction(async (tx) => {
    await tx.quotation.updateMany({
      where: { sessionId: params.sessionId, status: { in: ["DRAFT", "NEEDS_CLARIFICATION"] } },
      data: { status: "REJECTED" },
    });

    if (evaluation.status === "CONFIRMED") {
      const created = await tx.quotation.create({
        data: {
          sessionId: params.sessionId,
          supplierId: params.supplierId,
          status: "CONFIRMED",
          shippingFee: evaluation.shippingFee,
          leadTimeDays: evaluation.leadTimeDays,
          validUntil: evaluation.validUntil,
          confirmedAt: params.now,
          rawExtraction: raw,
          items: {
            create: evaluation.items.map((i) => ({
              productId: i.productId,
              quotedUnitPrice: i.quotedUnitPrice,
              availableQuantity: i.availableQuantity,
              minimumOrderQuantity: i.minimumOrderQuantity,
              packSize: i.packSize,
            })),
          },
        },
        select: { id: true },
      });
      return { quotationId: created.id, status: "CONFIRMED" as const, missing: [] };
    }

    const status = evaluation.status === "DECLINED" ? "REJECTED" : "NEEDS_CLARIFICATION";
    const created = await tx.quotation.create({
      data: { sessionId: params.sessionId, supplierId: params.supplierId, status, rawExtraction: raw },
      select: { id: true },
    });
    return { quotationId: created.id, status, missing: evaluation.status === "NEEDS_CLARIFICATION" ? evaluation.missing : [] };
  });
}
