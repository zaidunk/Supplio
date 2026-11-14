"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, useDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { iconProps } from "@/lib/ui/icons";

/** Membuat tautan onboarding sekali pakai. Tautan hanya ditampilkan di sini dan tidak disimpan di browser. */
export function TelegramLinkButton({ supplierId, connected }: { supplierId: string; connected: boolean }) {
  const dialog = useDialog();
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

  function onOpen() {
    dialog.open();
    void generate();
  }

  return (
    <>
      <div>
        <Button type="button" variant={connected ? "outline" : "default"} size="sm" disabled={pending} onClick={onOpen}>
          {connected ? <Copy {...iconProps} /> : null}
          {connected ? "Buat tautan baru" : "Hubungkan Telegram"}
        </Button>
      </div>
      <Dialog dialog={dialog} title="Hubungkan Telegram" description="Kirim tautan sekali pakai ini ke supplier.">
        {pending ? <p className="text-sm text-muted-foreground">Membuat tautan…</p> : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {link ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Berlaku sampai {formatDateTime(link.expiresAt)}.</p>
            <div className="flex gap-2">
              <Input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} aria-label="Tautan onboarding Telegram" />
              <Button type="button" onClick={copy}>
                {copied ? "Tersalin" : "Salin"}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
