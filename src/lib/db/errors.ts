/** Prisma P2002 (unique constraint). Dicek lewat `code` agar tidak bergantung pada identitas kelas. */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/** Prisma P2003 (foreign key constraint), mis. menghapus produk yang masih dipakai. */
export function isForeignKeyViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2003";
}
