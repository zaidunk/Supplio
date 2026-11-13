/** Kesalahan domain yang aman ditampilkan ke klien (kode stabil + pesan). */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
