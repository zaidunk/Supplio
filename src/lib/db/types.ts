import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/** Klien Prisma atau klien transaksi; fungsi domain menerimanya agar bisa diuji tanpa `server-only`. */
export type Db = PrismaClient | Prisma.TransactionClient;
