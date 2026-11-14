"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** `badge`: jumlah item yang menunggu tindakan pemilik; disembunyikan bila 0. */
export type NavItem = { href: string; label: string; badge?: number };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi utama" className="-mx-1 flex gap-1 overflow-x-auto px-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center rounded-xl px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-blue-50 font-medium text-blue-700"
                : "text-muted-foreground hover:bg-blue-50/60 hover:text-foreground",
            )}
          >
            {item.label}
            {item.badge ? (
              <span
                aria-label={`${item.badge} perlu perhatian`}
                className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground tabular-nums"
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
