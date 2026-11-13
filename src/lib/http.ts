import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AuthError } from "@/lib/auth/current-business";
import { DomainError } from "@/lib/errors";

type ErrorBody = { error: { code: string; message: string; issues?: { path: string; message: string }[] } };

const errorResponse = (status: number, body: ErrorBody["error"]) =>
  NextResponse.json({ error: body } satisfies ErrorBody, { status });

export function toErrorResponse(e: unknown): NextResponse {
  if (e instanceof AuthError) return errorResponse(401, { code: "UNAUTHENTICATED", message: e.message });
  if (e instanceof DomainError) return errorResponse(e.status, { code: e.code, message: e.message });
  if (e instanceof ZodError) {
    return errorResponse(400, {
      code: "VALIDATION_ERROR",
      message: "Data tidak valid.",
      issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (e instanceof SyntaxError) return errorResponse(400, { code: "INVALID_JSON", message: "Body bukan JSON yang valid." });

  // Hanya nama + pesan; jangan mencetak objek penuh (bisa memuat data sensitif).
  console.error("[api] unhandled error:", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  return errorResponse(500, { code: "INTERNAL_ERROR", message: "Terjadi kesalahan pada server." });
}

/** Bungkus handler: kesalahan apa pun dipetakan ke respons JSON yang konsisten. */
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  return schema.parse(await request.json());
}
