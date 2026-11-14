"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/dialog";
import { NavLinks, type NavBadges, type NavItem } from "@/components/nav-links";
import { MascotArt } from "@/components/mascot/mascot-art";
import { iconProps } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { useJelly } from "@/components/motion/use-jelly";
import { useEffect, useRef, useState } from "react";

function SidebarBody({
  items,
  badges,
  signOutAction,
  onNavigate,
  collapsed = false,
}: {
  items: NavItem[];
  badges: NavBadges;
  signOutAction: () => Promise<void>;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const mainItems = items.filter((item) => item.href !== "/settings");
  const settingsItems = items.filter((item) => item.href === "/settings");

  return (
    <div className={cn("flex h-full flex-col gap-6 p-4", collapsed && "items-stretch px-3")}>
      <div className={cn("flex shrink-0 items-center pt-2", collapsed ? "justify-center" : "px-3")}>
        <Link href="/dashboard" aria-label="Supplio, ke Dashboard" onClick={onNavigate} className="shrink-0">
          {collapsed ? (
            <MascotArt mood="idle" width={36} height={35} aria-hidden="true" />
          ) : (
            <Image src="/brand/wordmark.svg" alt="Supplio" width={108} height={31} priority />
          )}
        </Link>
      </div>
      <NavLinks items={mainItems} badges={badges} onNavigate={onNavigate} collapsed={collapsed} />
      <div className="mt-auto flex flex-col gap-3">
        <NavLinks items={settingsItems} badges={badges} onNavigate={onNavigate} collapsed={collapsed} label="Pengaturan" />
        <form action={signOutAction}>
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            aria-label={collapsed ? "Keluar" : undefined}
            title={collapsed ? "Keluar" : undefined}
          >
            <LogOut {...iconProps} />
            {collapsed ? null : "Keluar"}
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Kerangka dashboard: sidebar 264 px (bisa dilipat jadi 72 px berisi ikon saja) di desktop; di mobile bar atas dengan menu yang terbuka dari samping. */
export function AppShell({
  items,
  badges,
  signOutAction,
  children,
}: {
  items: NavItem[];
  badges: NavBadges;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const menu = useDialog();
  const element = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useJelly(menuButton, "icon");
  const { isOpen, close } = menu;
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = () => setCollapsed((prev) => !prev);

  useEffect(() => {
    const el = element.current;
    if (!el) return;
    if (isOpen && !el.open) el.showModal();
    if (!isOpen && el.open) el.close();
  }, [isOpen]);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-background transition-[width] duration-200 lg:block",
          collapsed ? "w-[72px]" : "w-[264px]",
        )}
      >
        <SidebarBody
          items={items}
          badges={badges}
          signOutAction={signOutAction}
          collapsed={collapsed}
        />
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"}
          className="absolute top-20 -right-3.5 z-30 inline-flex size-7 items-center justify-center rounded-full border border-line bg-background text-muted-foreground shadow-sm transition-colors hover:bg-blue-50 hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen {...iconProps} /> : <PanelLeftClose {...iconProps} />}
        </button>
      </aside>

      <header className="sticky top-0 z-20 grid h-14 grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-line bg-background/80 px-3 backdrop-blur-md lg:hidden">
        <button
          ref={menuButton}
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
        <SidebarBody items={items} badges={badges} signOutAction={signOutAction} onNavigate={close} />
      </dialog>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:p-12">{children}</main>
    </div>
  );
}
