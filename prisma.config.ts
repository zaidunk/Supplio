import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI tidak memuat .env.local milik Next.js; muat manual (prioritas .env.local).
loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // DIRECT_URL (koneksi langsung Supabase) dipakai untuk migrasi bila tersedia.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
