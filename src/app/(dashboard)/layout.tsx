import { signOut } from "@/app/login/actions";
import { AppShell } from "@/components/app-shell";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { listPurchaseOrders } from "@/lib/procurement/receiving";
import { listRequests } from "@/lib/procurement/queries";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const business = await requireBusiness();
  const [requests, openOrders] = await Promise.all([
    listRequests(prisma, business.id),
    listPurchaseOrders(prisma, business.id, { outstandingOnly: true }),
  ]);
  const awaitingApproval = requests.filter((r) => r.status === "AWAITING_APPROVAL").length;

  const NAV = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/inventory", label: "Inventory", icon: "inventory" },
    { href: "/suppliers", label: "Supplier", icon: "suppliers" },
    { href: "/procurement", label: "Procurement", icon: "procurement", badge: awaitingApproval },
    { href: "/receiving", label: "Penerimaan", icon: "receiving", badge: openOrders.length },
    { href: "/settings", label: "Pengaturan", icon: "settings" },
  ] as const;

  return (
    <AppShell items={[...NAV]} businessName={business.name} signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
