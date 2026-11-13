import { after, NextResponse } from "next/server";
import { dispatchApproved } from "@/inngest/dispatch";
import { requireBusinessForApi } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { parseBody, route } from "@/lib/http";
import { approveRecommendation } from "@/lib/procurement/approval";
import { sendOrderConfirmations } from "@/lib/procurement/orders";
import { getTelegramClient } from "@/lib/telegram/server";
import { idSchema } from "@/lib/validation/common";
import { approveSchema } from "@/lib/validation/orders";

/**
 * Final Approval (SUPPLIO.md §4.3). HANYA owner terautentikasi (requireBusinessForApi); tidak ada jalur dari AI/supplier.
 * Memvalidasi ulang dalam transaksi database dan membuat PO per supplier; klik ganda tidak menggandakan PO.
 */
export const POST = route(async (request: Request, ctx: RouteContext<"/api/procurement/[id]/approve">) => {
  const business = await requireBusinessForApi();
  const requestId = idSchema.parse((await ctx.params).id);
  const body = await parseBody(request, approveSchema);

  const result = await approveRecommendation(prisma, { businessId: business.id, requestId, ...body });

  if (result.outcome === "REVALIDATION_FAILED") {
    return NextResponse.json(
      {
        error: {
          code: "REVALIDATION_FAILED",
          message: "Data penawaran berubah sejak rekomendasi dibuat, jadi tidak ada pesanan yang dibuat. Rekomendasi dihitung ulang; tinjau lagi.",
          violations: result.violations,
          rerun: result.rerun,
        },
      },
      { status: 409 },
    );
  }

  // PO sudah sah → kirim konfirmasi order. Lewat Inngest; bila tidak terjangkau, kirim langsung setelah respons (idempoten).
  if (!(await dispatchApproved(requestId, business.id))) {
    after(async () => {
      try {
        await sendOrderConfirmations(prisma, getTelegramClient(), { businessId: business.id, requestId });
      } catch (e) {
        console.error("[orders] pengiriman konfirmasi cadangan gagal:", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      }
    });
  }
  return NextResponse.json(result, { status: result.outcome === "APPROVED" ? 201 : 200 });
});
