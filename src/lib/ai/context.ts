import type { NegotiationStatus } from "@/generated/prisma/client";
import type { Db } from "@/lib/db/types";
import { DomainError } from "@/lib/errors";
import { MAX_AI_MESSAGES_PER_SESSION, MAX_CLARIFICATIONS, MAX_COUNTER_OFFERS } from "./constants";

/**
 * ProcurementContext (SUPPLIO.md §6): snapshot terstruktur dari PostgreSQL untuk SATU sesi, hanya data yang
 * diperlukan agen. LLM tidak pernah menerima seluruh database. Semua pencarian terikat businessId + requestId
 * + sessionId yang ditentukan backend, tidak pernah dari argumen model.
 */
export interface ContextIds {
  businessId: string;
  requestId: string;
  sessionId: string;
}

export interface ProcurementContext {
  business: { name: string };
  supplier: { id: string; name: string };
  session: {
    id: string;
    status: NegotiationStatus;
    negotiationRound: number;
    counterOffersRemaining: number;
    clarificationsUsed: number;
    clarificationsRemaining: number;
    aiMessagesRemaining: number;
  };
  /** Hanya produk yang diminta request DAN disuplai supplier ini. */
  items: {
    productId: string;
    productName: string;
    unit: string;
    quantityScale: number;
    requiredQuantity: string;
    maxDeliveryDays: number;
    supplierReference: {
      unitPrice: number;
      minimumOrderQuantity: string;
      packSize: string | null;
      leadTimeDays: number;
      shippingFee: number | null;
    };
  }[];
  /** Penawaran terbaru dari supplier ini pada sesi ini (ringkas), bila ada. */
  currentQuotation: { status: string; shippingFee: number | null; leadTimeDays: number | null; itemCount: number } | null;
  /** Ringkasan anonim penawaran lain; nama supplier lain tidak pernah diberikan ke model. */
  competition: {
    otherConfirmedQuotations: number;
    bestConfirmedUnitPriceByProduct: { productId: string; unitPrice: number }[];
  };
  /** RAHASIA: untuk kebijakan negosiasi, tidak boleh disebut ke supplier (ditegakkan guard). */
  confidential: {
    restockBudget: number;
    maximumUnitPriceByProduct: { productId: string; maximumUnitPrice: number }[];
    lastPurchaseUnitPriceByProduct: { productId: string; unitPrice: number }[];
  };
}

/** Sumber kebenaran jumlah pesan AI per sesi (kunci idempotensi memuat jenisnya). */
export const outboundKeyPrefix = (sessionId: string) => `session:${sessionId}:`;

export async function countAiMessages(db: Db, sessionId: string): Promise<number> {
  return db.conversationMessage.count({ where: { sessionId, direction: "OUTBOUND", sender: "AI" } });
}

export async function countOutboundByKind(db: Db, sessionId: string, kind: "COUNTER_OFFER" | "CLARIFICATION"): Promise<number> {
  return db.conversationMessage.count({
    where: { idempotencyKey: { startsWith: outboundKeyPrefix(sessionId), endsWith: `:out:${kind}` } },
  });
}

export async function buildProcurementContext(db: Db, ids: ContextIds): Promise<ProcurementContext> {
  const session = await db.negotiationSession.findFirst({
    where: { id: ids.sessionId, requestId: ids.requestId, businessId: ids.businessId },
    select: {
      id: true,
      status: true,
      supplier: {
        select: {
          id: true,
          name: true,
          products: {
            select: {
              productId: true,
              referenceUnitPrice: true,
              minimumOrderQuantity: true,
              packSize: true,
              referenceLeadTimeDays: true,
              referenceShippingFee: true,
            },
          },
        },
      },
      request: {
        select: {
          restockBudget: true,
          business: { select: { name: true } },
          items: {
            select: {
              productId: true,
              requiredQuantity: true,
              maxDeliveryDays: true,
              product: { select: { name: true, unit: true, quantityScale: true, maximumUnitPrice: true, lastPurchaseUnitPrice: true } },
            },
          },
        },
      },
    },
  });
  if (!session) throw new DomainError("SESSION_NOT_FOUND", "Sesi negosiasi tidak ditemukan.", 404);

  const [counterOffers, clarifications, aiMessages, currentQuotation, others] = await Promise.all([
    countOutboundByKind(db, ids.sessionId, "COUNTER_OFFER"),
    countOutboundByKind(db, ids.sessionId, "CLARIFICATION"),
    countAiMessages(db, ids.sessionId),
    db.quotation.findFirst({
      where: { sessionId: ids.sessionId },
      orderBy: { createdAt: "desc" },
      select: { status: true, shippingFee: true, leadTimeDays: true, _count: { select: { items: true } } },
    }),
    db.quotation.findMany({
      where: { status: "CONFIRMED", session: { requestId: ids.requestId, businessId: ids.businessId }, supplierId: { not: session.supplier.id } },
      select: { supplierId: true, createdAt: true, items: { select: { productId: true, quotedUnitPrice: true } } },
    }),
  ]);

  const supplied = new Map(session.supplier.products.map((p) => [p.productId, p]));
  const items = session.request.items
    .filter((i) => supplied.has(i.productId))
    .map((i) => {
      const ref = supplied.get(i.productId)!;
      return {
        productId: i.productId,
        productName: i.product.name,
        unit: i.product.unit,
        quantityScale: i.product.quantityScale,
        requiredQuantity: i.requiredQuantity.toString(),
        maxDeliveryDays: i.maxDeliveryDays,
        supplierReference: {
          unitPrice: ref.referenceUnitPrice,
          minimumOrderQuantity: ref.minimumOrderQuantity.toString(),
          packSize: ref.packSize?.toString() ?? null,
          leadTimeDays: ref.referenceLeadTimeDays,
          shippingFee: ref.referenceShippingFee,
        },
      };
    });
  const productIds = new Set(items.map((i) => i.productId));

  const best = new Map<string, number>();
  for (const q of others) {
    for (const it of q.items) {
      if (!productIds.has(it.productId)) continue;
      best.set(it.productId, Math.min(best.get(it.productId) ?? Infinity, it.quotedUnitPrice));
    }
  }

  return {
    business: { name: session.request.business.name },
    supplier: { id: session.supplier.id, name: session.supplier.name },
    session: {
      id: session.id,
      status: session.status,
      negotiationRound: counterOffers,
      counterOffersRemaining: Math.max(0, MAX_COUNTER_OFFERS - counterOffers),
      clarificationsUsed: clarifications,
      clarificationsRemaining: Math.max(0, MAX_CLARIFICATIONS - clarifications),
      aiMessagesRemaining: Math.max(0, MAX_AI_MESSAGES_PER_SESSION - aiMessages),
    },
    items,
    currentQuotation: currentQuotation
      ? {
          status: currentQuotation.status,
          shippingFee: currentQuotation.shippingFee,
          leadTimeDays: currentQuotation.leadTimeDays,
          itemCount: currentQuotation._count.items,
        }
      : null,
    competition: {
      otherConfirmedQuotations: new Set(others.map((q) => q.supplierId)).size,
      bestConfirmedUnitPriceByProduct: [...best].map(([productId, unitPrice]) => ({ productId, unitPrice })),
    },
    confidential: {
      restockBudget: session.request.restockBudget,
      maximumUnitPriceByProduct: session.request.items
        .filter((i) => productIds.has(i.productId) && i.product.maximumUnitPrice !== null)
        .map((i) => ({ productId: i.productId, maximumUnitPrice: i.product.maximumUnitPrice! })),
      lastPurchaseUnitPriceByProduct: session.request.items
        .filter((i) => productIds.has(i.productId) && i.product.lastPurchaseUnitPrice !== null)
        .map((i) => ({ productId: i.productId, unitPrice: i.product.lastPurchaseUnitPrice! })),
    },
  };
}

/** Nama supplier lain di request (hanya untuk penjaga pesan keluar; tidak pernah diberikan ke model). */
export async function otherSupplierNames(db: Db, ids: ContextIds, supplierId: string): Promise<string[]> {
  const rows = await db.supplier.findMany({
    where: { businessId: ids.businessId, id: { not: supplierId } },
    select: { name: true },
  });
  return rows.map((r) => r.name);
}
