import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: getServerEnv().DATABASE_URL });
  // Default Prisma 5 dtk terlalu pendek untuk transaksi interaktif berisi puluhan query lewat pooler Supabase
  // (mis. Final Approval); kedaluwarsa di tengah jalan membuat request 500 meski datanya benar.
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 10_000, timeout: 30_000 } });
}

/** Singleton agar hot-reload dev tidak membuka koneksi baru terus-menerus. */
export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
