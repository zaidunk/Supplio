"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/dialog";
import { NavLinks, type NavBadges, type NavItem } from "@/components/nav-links";
import { iconProps } from "@/lib/ui/icons";
import { useEffect, useRef } from "react";

function SidebarBody({
  items,
  badges,
  businessName,
  signOutAction,
  onNavigate,
}: {
  items: NavItem[];
  badges: NavBadges;
  businessName: string;
  signOutAction: () => Promise<void>;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/dashboard" aria-label="Supplio, ke Dashboard" onClick={onNavigate} className="shrink-0 px-3 pt-2">
        <Image src="/brand/wordmark.svg" alt="Supplio" width={108} height={31} priority />
      </Link>
      <NavLinks items={items} badges={badges} onNavigate={onNavigate} />
      <div className="mt-auto flex flex-col gap-3">
        <div className="flex flex-col rounded-xl bg-surface-sunken p-3">
          <span className="truncate text-sm font-medium">{businessName}</span>
          <span className="text-xs text-muted-foreground">Pemilik bisnis</span>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="w-full">
            <LogOut {...iconProps} />
            Keluar
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Kerangka dashboard: sidebar tetap 264 px di desktop; di mobile bar atas dengan menu yang terbuka dari samping. */
export function AppShell({
  items,
  badges,
  businessName,
  signOutAction,
  children,
}: {
  items: NavItem[];
  badges: NavBadges;
  businessName: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const menu = useDialog();
  const element = useRef<HTMLDialogElement>(null);
  const { isOpen, close } = menu;

  useEffect(() => {
    const el = element.current;
    if (!el) return;
    if (isOpen && !el.open) el.showModal();
    if (!isOpen && el.open) el.close();
  }, [isOpen]);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 border-r border-line bg-background lg:block">
        <SidebarBody items={items} badges={badges} businessName={businessName} signOutAction={signOutAction} />
      </aside>

      <header className="sticky top-0 z-20 grid h-14 grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-line bg-background/80 px-3 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={menu.open}
          aria-label="Buka menu"
          className="inline-flex size-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-blue-50"
        >
          <Menu {...iconProps} />
        </button>
        <Link href="/dashboard" aria-label="Supplio, ke Dashboard" className="justify-self-center">
          <Image src="/brand/wordmark.svg" alt="Supplio" width={96} height={28} priority />
        </Link>
      </header>

      <dialog
        ref={element}
        onClose={close}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        aria-label="Menu navigasi"
        className="m-0 h-dvh max-h-none w-[264px] max-w-[85vw] bg-background p-0 text-foreground shadow-lg backdrop:bg-blue-950/40 lg:hidden"
      >
        <SidebarBody items={items} badges={badges} businessName={businessName} signOutAction={signOutAction} onNavigate={close} />
      </dialog>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:p-12">{children}</main>
    </div>
  );
}
