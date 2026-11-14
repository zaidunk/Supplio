"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

/** Membuat tautan onboarding sekali pakai. Tautan hanya ditampilkan di sini dan tidak disimpan di browser. */
export function TelegramLinkButton({ supplierId, connected }: { supplierId: string; connected: boolean }) {
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    setCopied(false);
    try {
      setLink(await apiRequest<{ url: string; expiresAt: string }>(`/api/suppliers/${supplierId}/telegram-link`, "POST"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat tautan.");
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setCopied(false); // clipboard bisa diblokir; pengguna masih bisa menyalin manual dari kolom
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button type="button" variant={connected ? "outline" : "default"} size="sm" disabled={pending} onClick={generate}>
          {connected ? "Buat tautan baru" : "Hubungkan Telegram"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {link ? (
        <div className="flex max-w-xl flex-col gap-1.5 rounded-md border p-3">
          <p className="text-sm text-muted-foreground">
            Berlaku sampai {formatDateTime(link.expiresAt)}.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} aria-label="Tautan onboarding Telegram" />
            <Button type="button" size="sm" onClick={copy}>
              {copied ? "Tersalin" : "Salin"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
