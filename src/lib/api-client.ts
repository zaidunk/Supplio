/** Klien fetch ke API internal untuk komponen client. Pesan galat dari server diteruskan apa adanya. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T = unknown>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;

  const json = (await res.json().catch(() => null)) as
    | { error?: { code?: string; message?: string; issues?: { path: string; message: string }[] } }
    | null;
  if (!res.ok) {
    const e = json?.error;
    const detail = e?.issues?.length ? e.issues.map((i) => `${i.path}: ${i.message}`).join("; ") : e?.message;
    throw new ApiError(detail ?? `Permintaan gagal (${res.status})`, e?.code ?? "UNKNOWN");
  }
  return json as T;
}

/** Ubah isian form: kosong → null/undefined, angka bila diminta. */
export const blankToNull = (v: string): string | null => (v.trim() === "" ? null : v.trim());
export const toIntOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v));
