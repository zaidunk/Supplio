import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Bandingkan secret webhook secara waktu-konstan (di-hash dulu agar panjangnya sama dan tidak bocor lewat timing). */
export function secretMatches(received: string | null, expected: string): boolean {
  return received !== null && timingSafeEqual(digest(received), digest(expected));
}
