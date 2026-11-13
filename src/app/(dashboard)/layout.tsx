import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth/current-business";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/suppliers", label: "Supplier" },
  { href: "/procurement", label: "Procurement" },
  { href: "/receiving", label: "Penerimaan" },
  { href: "/settings", label: "Pengaturan" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const business = await requireBusiness();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex min-w-0 flex-wrap items-center gap-x-8 gap-y-2">
            <Link href="/dashboard" aria-label="Supplio, ke Dashboard" className="shrink-0">
              <Image src="/brand/icon.svg" alt="" width={32} height={31} className="sm:hidden" priority />
              <Image
                src="/brand/wordmark.svg"
                alt="Supplio"
                width={96}
                height={28}
                className="hidden sm:block"
                priority
              />
            </Link>
            <NavLinks items={NAV} />
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">{business.name}</span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Keluar
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">{children}</main>
    </div>
  );
}
