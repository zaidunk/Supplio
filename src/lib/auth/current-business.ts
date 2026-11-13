import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AuthError extends Error {
  constructor(message = "Tidak terautentikasi") {
    super(message);
    this.name = "AuthError";
  }
}

/** User Supabase terverifikasi (getUser memvalidasi token ke server Auth, bukan sekadar membaca cookie). */
export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/**
 * Business milik user yang sedang login. Dibuat otomatis pada login pertama
 * (satu owner = satu Business; MVP satu UMKM) beserta AISettings versi 1.
 */
export const getCurrentBusiness = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const existing = await prisma.business.findUnique({ where: { ownerUserId: user.id } });
  if (existing) return existing;

  const name = user.email ? `UMKM ${user.email.split("@")[0]}` : "UMKM Saya";
  const business = await prisma.business.upsert({
    where: { ownerUserId: user.id },
    create: { ownerUserId: user.id, name },
    update: {},
  });
  await prisma.aISettings.createMany({
    data: [{ businessId: business.id, version: 1 }],
    skipDuplicates: true,
  });
  return business;
});

/** Untuk halaman: redirect ke /login bila belum login. */
export async function requireBusiness() {
  const business = await getCurrentBusiness();
  if (!business) redirect("/login");
  return business;
}

/**
 * Untuk Route Handler owner: lempar AuthError (dipetakan ke 401 oleh handler).
 * Semua query harus difilter dengan `business.id` yang dikembalikan di sini,
 * tidak pernah dengan businessId dari body/query client.
 */
export async function requireBusinessForApi() {
  const business = await getCurrentBusiness();
  if (!business) throw new AuthError();
  return business;
}
