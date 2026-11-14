"use client";

import { JellyLink } from "@/components/jelly-link";
import { Suspense, use } from "react";
import { usePathname } from "next/navigation";
import { NAV_ICON, iconProps } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export type NavBadges = Promise<{ awaitingApproval: number; openOrders: number }>;

/** `badgeKey`: jumlah item yang menunggu tindakan pemilik (dari `badges`); disembunyikan bila 0. `icon` kunci ke NAV_ICON (komponen tidak bisa dikirim dari server). */
export type NavItem = { href: string; label: string; icon: keyof typeof NAV_ICON; badgeKey?: "awaitingApproval" | "openOrders" };

function NavBadge({ badgeKey, badges, collapsed }: { badgeKey: NonNullable<NavItem["badgeKey"]>; badges: NavBadges; collapsed?: boolean }) {
  const count = use(badges)[badgeKey];
  if (!count) return null;
  return (
    <span
      aria-label={`${count} perlu perhatian`}
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground tabular-nums",
        collapsed ? "absolute -top-1 -right-1" : "ml-auto",
      )}
    >
      {count}
    </span>
  );
}

export function NavLinks({
  items,
  badges,
  onNavigate,
  collapsed = false,
  label = "Navigasi utama",
}: {
  items: NavItem[];
  badges: NavBadges;
  onNavigate?: () => void;
  collapsed?: boolean;
  label?: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = NAV_ICON[item.icon];
        return (
          <JellyLink
            key={item.href}
            motion="nav"
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-colors",
              collapsed && "justify-center px-0",
              active
                ? "bg-blue-50 text-blue-700"
                : "text-muted-foreground hover:bg-blue-50/60 hover:text-foreground",
            )}
          >
            <Icon {...iconProps} />
            <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
            {item.badgeKey ? (
              <Suspense fallback={null}>
                <NavBadge badgeKey={item.badgeKey} badges={badges} collapsed={collapsed} />
              </Suspense>
            ) : null}
          </JellyLink>
        );
      })}
    </nav>
  );
}
