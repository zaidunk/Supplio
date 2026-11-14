import { signOut } from "@/app/login/actions";
import { AppShell } from "@/components/app-shell";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { getNavBadgeCounts } from "@/lib/procurement/nav-counts";

const NAV = [
  { href: "/inventory", label: "Inventory", icon: "inventory" },
  { href: "/suppliers", label: "Supplier", icon: "suppliers" },
  { href: "/procurement", label: "Procurement", icon: "procurement", badgeKey: "awaitingApproval" },
  { href: "/receiving", label: "Penerimaan", icon: "receiving", badgeKey: "openOrders" },
  { href: "/settings", label: "Pengaturan", icon: "settings" },
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const business = await requireBusiness();
  // Tidak di-await: badge mengalir (stream) belakangan agar shell dan loading.tsx tampil segera.
  const badges = getNavBadgeCounts(prisma, business.id);

  return (
    <AppShell items={[...NAV]} badges={badges} signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
