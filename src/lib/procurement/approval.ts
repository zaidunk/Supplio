import type { PrismaClient, ProcurementStatus } from "@/generated/prisma/client";
import { DomainError } from "@/lib/errors";
import { validateSolution } from "@/lib/optimization/validate";
import type { Violation } from "@/lib/optimization/types";
import { FINAL_SESSION_STATUSES } from "./sessions";
import { generatePoNumber, lineCost } from "./orders";
import { loadOptimizerInput, runOptimization } from "./optimize";
import { transitionRequestTx } from "./transition";

/**
 * Final Approval & Reject (SUPPLIO.md §4.3, §13). HANYA dipanggil dari endpoint owner terautentikasi; tidak ada
 * jalur dari AI/supplier. Semua perubahan finansial terjadi dalam SATU transaksi dengan kunci baris pada request.
 */
export interface ApprovedOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  totalCost: number;
}

export type ApproveResult =
  | { outcome: "APPROVED" | "DUPLICATE"; orders: ApprovedOrder[] }
  /** Data berubah sejak rekomendasi dibuat: TIDAK memesan; request kembali ke optimasi dan dihitung ulang. */
  | {
      outcome: "REVALIDATION_FAILED";
      violations: Pick<Violation, "code" | "message">[];
      rerun: "AWAITING_APPROVAL" | "NO_FEASIBLE_SOLUTION" | "FAILED";
    };

const ORDERED_STATUSES: ProcurementStatus[] = ["APPROVED", "ORDERED", "PARTIALLY_RECEIVED", "COMPLETED"];

export async function approveRecommendation(
  db: PrismaClient,
  params: { businessId: string; requestId: string; recommendationId?: string; idempotencyKey?: string; now?: Date },
): Promise<ApproveResult> {
  const { businessId, requestId } = params;
  const now = params.now ?? new Date();
  // Namespace per bisnis: kunci dari klien tidak bisa bentrok antar tenant.
  const approvalKey = `${businessId}:${params.idempotencyKey ?? `approve:${requestId}`}`;

  let failed: Pick<Violation, "code" | "message">[] | null = null;

  const approved = await db.$transaction(async (tx) => {
    // Dua klik/dua tab: yang kedua menunggu di sini, lalu melihat hasil yang pertama (idempoten, tanpa PO ganda).
    await tx.$queryRaw`SELECT id FROM "ProcurementRequest" WHERE id = ${requestId} AND "businessId" = ${businessId} FOR UPDATE`;

    const request = await tx.procurementRequest.findFirst({
      where: { id: requestId, businessId },
      select: { status: true, expiresAt: true, approvalKey: true },
    });
    if (!request) throw new DomainError("REQUEST_NOT_FOUND", "Procurement request tidak ditemukan.", 404);

    if (ORDERED_STATUSES.includes(request.status)) {
      if (request.approvalKey !== null && (params.idempotencyKey === undefined || request.approvalKey === approvalKey)) {
        return { duplicate: true as const, orders: await existingOrders(tx, requestId) };
      }
      throw new DomainError("ALREADY_APPROVED", "Request ini sudah disetujui dengan permintaan yang berbeda.", 409);
    }
    if (request.status !== "AWAITING_APPROVAL") {
      throw new DomainError("REQUEST_NOT_AWAITING_APPROVAL", `Request tidak menunggu persetujuan (status ${request.status}).`, 409);
    }
    if (request.expiresAt && request.expiresAt.getTime() <= now.getTime()) {
      throw new DomainError("REQUEST_EXPIRED", "Request sudah kedaluwarsa dan tidak bisa disetujui.", 409);
    }

    const recommendation = await tx.procurementRecommendation.findFirst({
      where: { requestId },
      orderBy: { createdAt: "desc" },
      include: { items: true, suppliers: true },
    });
    if (!recommendation || recommendation.solverStatus !== "OPTIMAL") {
      throw new DomainError("NO_RECOMMENDATION", "Belum ada rekomendasi valid untuk disetujui.", 409);
    }
    if (params.recommendationId && params.recommendationId !== recommendation.id) {
      throw new DomainError("STALE_RECOMMENDATION", "Rekomendasi sudah diperbarui; muat ulang halaman sebelum menyetujui.", 409);
    }

    // ── Validasi ulang independen atas data TERKINI (§4.3) ─────────────────────────────────
    const input = await loadOptimizerInput(tx, businessId, requestId, now);
    const check = validateSolution(
      input,
      recommendation.items.map((i) => ({ quotationItemId: i.quotationItemId, quantity: i.quantity.toString() })),
    );
    const violations: Pick<Violation, "code" | "message">[] = check.violations.map((v) => ({ code: v.code, message: v.message }));

    // Harga/total yang disetujui pemilik harus sama dengan hitungan ulang dari penawaran saat ini.
    const currentPrice = new Map(
      input.quotations.flatMap((q) => q.items.map((i) => [i.quotationItemId, i.quotedUnitPrice] as const)),
    );
    for (const item of recommendation.items) {
      const now_ = currentPrice.get(item.quotationItemId);
      if (now_ !== undefined && now_ !== item.unitPrice) {
        violations.push({ code: "PRICE_CHANGED", message: `Harga penawaran berubah dari ${item.unitPrice} menjadi ${now_}.` });
      }
    }
    if (check.totals) {
      if (check.totals.totalCost !== recommendation.totalCost) {
        violations.push({ code: "TOTAL_MISMATCH", message: `Total hitung ulang ${check.totals.totalCost} berbeda dari rekomendasi ${recommendation.totalCost}.` });
      }
      const shipping = new Map(recommendation.suppliers.map((s) => [s.supplierId, s.shippingFee]));
      for (const s of check.totals.suppliers) {
        if (shipping.get(s.supplierId) !== s.shippingFee) {
          violations.push({ code: "SHIPPING_CHANGED", message: `Ongkir ${s.supplierName} berubah.` });
        }
      }
    }

    if (violations.length > 0) {
      // JANGAN memesan: kembali ke optimasi (transaksi ini tetap commit agar status tercatat).
      await transitionRequestTx(tx, {
        requestId,
        businessId,
        to: "OPTIMIZING",
        reason: `Validasi ulang saat approval gagal: ${[...new Set(violations.map((v) => v.code))].join(", ")}`,
      });
      failed = violations;
      return null;
    }

    // ── Persetujuan sah: satu PO per supplier terpilih ─────────────────────────────────────
    const supplierNames = new Map(
      (await tx.supplier.findMany({ where: { id: { in: recommendation.suppliers.map((s) => s.supplierId) } }, select: { id: true, name: true } })).map((s) => [s.id, s.name]),
    );
    await tx.procurementRequest.update({ where: { id: requestId }, data: { approvedByOwnerAt: now, approvalKey } });
    await transitionRequestTx(tx, { requestId, businessId, to: "APPROVED", reason: "Disetujui pemilik (Final Approval)" });

    const orders: ApprovedOrder[] = [];
    for (const rs of recommendation.suppliers) {
      const items = recommendation.items.filter((i) => i.supplierId === rs.supplierId);
      const itemsCost = items.reduce((sum, i) => sum + lineCost(i.unitPrice, i.quantity), 0);
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber: generatePoNumber(now),
          requestId,
          supplierId: rs.supplierId,
          businessId,
          status: "CREATED",
          shippingFee: rs.shippingFee,
          totalCost: itemsCost + rs.shippingFee,
          idempotencyKey: `approval:${requestId}:${rs.supplierId}`,
          items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity.toString(), unitPrice: i.unitPrice })) },
        },
        select: { id: true, poNumber: true, totalCost: true },
      });
      orders.push({ id: po.id, poNumber: po.poNumber, supplierId: rs.supplierId, supplierName: supplierNames.get(rs.supplierId) ?? "", totalCost: po.totalCost });
    }
    await transitionRequestTx(tx, { requestId, businessId, to: "ORDERED", reason: `PO dibuat: ${orders.map((o) => o.poNumber).join(", ")}` });

    // Pastikan total PO persis sama dengan total rekomendasi yang disetujui pemilik.
    const poTotal = orders.reduce((s, o) => s + o.totalCost, 0);
    if (poTotal !== recommendation.totalCost) {
      throw new DomainError("PO_TOTAL_MISMATCH", "Total PO tidak cocok dengan rekomendasi; persetujuan dibatalkan.", 500);
    }
    return { duplicate: false as const, orders };
  });

  if (approved) return { outcome: approved.duplicate ? "DUPLICATE" : "APPROVED", orders: approved.orders };

  // Validasi gagal: hitung ulang rekomendasi dengan data terkini agar pemilik bisa meninjau ulang.
  let rerun: "AWAITING_APPROVAL" | "NO_FEASIBLE_SOLUTION" | "FAILED" = "FAILED";
  try {
    rerun = (await runOptimization(db, { businessId, requestId, now })).requestStatus;
  } catch {
    rerun = "FAILED"; // request tetap OPTIMIZING; dapat dijalankan ulang tanpa risiko order
  }
  return { outcome: "REVALIDATION_FAILED", violations: failed ?? [], rerun };
}

async function existingOrders(tx: Pick<PrismaClient, "purchaseOrder">, requestId: string): Promise<ApprovedOrder[]> {
  const pos = await tx.purchaseOrder.findMany({
    where: { requestId },
    orderBy: { createdAt: "asc" },
    select: { id: true, poNumber: true, supplierId: true, totalCost: true, supplier: { select: { name: true } } },
  });
  return pos.map((p) => ({ id: p.id, poNumber: p.poNumber, supplierId: p.supplierId, supplierName: p.supplier.name, totalCost: p.totalCost }));
}

/**
 * Reject/Cancel oleh pemilik. Boleh selama request belum dipesan (DRAFT..AWAITING_APPROVAL). Sesi yang masih berjalan
 * ditutup sehingga balasan susulan supplier tidak memulai apa pun. Idempoten.
 */
export async function rejectRequest(
  db: PrismaClient,
  params: { businessId: string; requestId: string; reason?: string },
): Promise<{ alreadyCancelled: boolean }> {
  const { businessId, requestId } = params;
  const reason = params.reason?.replace(/\s+/g, " ").trim().slice(0, 200);

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ProcurementRequest" WHERE id = ${requestId} AND "businessId" = ${businessId} FOR UPDATE`;
    const { changed } = await transitionRequestTx(tx, {
      requestId,
      businessId,
      to: "CANCELLED",
      reason: reason ? `Dibatalkan pemilik: ${reason}` : "Dibatalkan pemilik",
    });
    await tx.negotiationSession.updateMany({
      where: { requestId, businessId, status: { notIn: [...FINAL_SESSION_STATUSES] } },
      data: { status: "TIMED_OUT" },
    });
    return { alreadyCancelled: !changed };
  });
}
