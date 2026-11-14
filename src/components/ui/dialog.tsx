"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useJelly } from "@/components/motion/use-jelly";
import { cn } from "@/lib/utils";
import { iconProps } from "@/lib/ui/icons";

/** Kendali buka/tutup untuk <Dialog>; pemegangnya bebas (tombol, menu) tanpa state tambahan. */
export function useDialog(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return { isOpen, open, close };
}

/**
 * Pembungkus <dialog> native: Esc dan klik latar menutup, fokus dikembalikan browser ke pemicu.
 * Isi tetap terpasang saat tertutup, sehingga state form (mis. kunci idempotensi) bertahan sampai berhasil.
 */
export function Dialog({
  dialog,
  title,
  description,
  wide = false,
  onClose,
  children,
}: {
  dialog: ReturnType<typeof useDialog>;
  title: string;
  description?: string;
  /** Lebar 720 px untuk form banyak kolom; default 480 px. */
  wide?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const element = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useJelly(closeButton, "icon");
  const { isOpen, close } = dialog;

  // Sinkronkan state ke <dialog> native; Esc menutup lewat event `close` yang mengembalikan state.
  useEffect(() => {
    const el = element.current;
    if (!el) return;
    if (isOpen && !el.open) el.showModal();
    if (!isOpen && el.open) el.close();
  }, [isOpen]);

  return (
    <dialog
      ref={element}
      onClose={() => {
        close();
        onClose?.();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      aria-labelledby={titleId}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-line bg-surface-raised p-0 text-foreground shadow-lg backdrop:bg-blue-950/40",
        wide ? "max-w-[720px]" : "max-w-[480px]",
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-lg font-medium">
              {title}
            </h2>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            aria-label="Tutup"
            className="-mt-1 -mr-2 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-blue-50 hover:text-foreground"
          >
            <X {...iconProps} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
