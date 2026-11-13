import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { requireBusiness } from "@/lib/auth/current-business";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const business = await requireBusiness();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold">
            Supplio
          </Link>
          <span className="text-sm text-muted-foreground">{business.name}</span>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Keluar
          </Button>
        </form>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
