import type { PrismaClient } from "@/generated/prisma/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { DomainError } from "@/lib/errors";
import { evaluateRestock, type EvaluateOutcome } from "@/lib/procurement/trigger";

export async function getBusinessSettings(db: PrismaClient, businessId: string) {
  const b = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { name: true, defaultRestockBudget: true, responseTimeoutMinutes: true },
  });
  return b;
}

/** Ubah budget/timeout default. Budget baru hanya berlaku untuk request BERIKUTNYA (snapshot). */
export async function updateBusinessSettings(
  db: PrismaClient,
  businessId: string,
  input: { defaultRestockBudget: number; responseTimeoutMinutes: number },
  opts: { expiryHours: number },
): Promise<{ trigger: EvaluateOutcome }> {
  const updated = await db.business.update({
    where: { id: businessId },
    data: input,
    select: { updatedAt: true },
  });
  // Budget yang baru diisi bisa membuka blokir CONFIGURATION_REQUIRED.
  const trigger = await evaluateRestock(db, {
    businessId,
    evaluationKey: `settings:${updated.updatedAt.toISOString()}`,
    expiryHours: opts.expiryHours,
  });
  return { trigger };
}

export async function getActiveAiSettings(db: PrismaClient, businessId: string) {
  const row = await db.aISettings.findFirst({
    where: { businessId },
    orderBy: { version: "desc" },
    select: { version: true, communicationTone: true, negotiationStyle: true, customInstructions: true, createdAt: true },
  });
  if (!row) throw new DomainError("AI_SETTINGS_MISSING", "Pengaturan AI belum ada.", 404);
  return row;
}

/**
 * Append-only: tiap perubahan = versi baru. Request/sesi yang sudah berjalan tetap memakai versi lamanya
 * (aiSettingsVersion), sehingga perubahan tidak memengaruhi negosiasi aktif secara diam-diam (§6).
 */
export async function saveAiSettings(
  db: PrismaClient,
  businessId: string,
  input: { communicationTone: string; negotiationStyle: string; customInstructions: string },
) {
  try {
    return await db.$transaction(async (tx) => {
      const latest = await tx.aISettings.findFirst({
        where: { businessId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      return tx.aISettings.create({
        data: { businessId, version: (latest?.version ?? 0) + 1, ...input },
        select: { version: true, communicationTone: true, negotiationStyle: true, customInstructions: true, createdAt: true },
      });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("AI_SETTINGS_CONFLICT", "Pengaturan diubah bersamaan; coba lagi.", 409);
    throw e;
  }
}
