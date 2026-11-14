import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProcurementStatus } from "@/generated/prisma/enums";
import { iconProps, PO_STATUS_ICON, PRODUCT_STATUS_ICON, REQUEST_STATUS_ICON, SUPPLIER_STATUS_ICON } from "@/lib/ui/icons";
import { PO_STATUS_LABEL, STATUS_LABEL, type PoStatus } from "@/lib/ui/status";

type Variant = NonNullable<React.ComponentProps<typeof Badge>["variant"]>;

const REQUEST_VARIANT: Record<ProcurementStatus, Variant> = {
  CONFIGURATION_REQUIRED: "warning",
  DRAFT: "neutral",
  SOURCING: "info",
  AWAITING_RESPONSES: "info",
  OPTIMIZING: "info",
  AWAITING_APPROVAL: "warning",
  APPROVED: "success",
  ORDERED: "success",
  PARTIALLY_RECEIVED: "info",
  COMPLETED: "success",
  NO_FEASIBLE_SOLUTION: "destructive",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
};

const PO_VARIANT: Record<PoStatus, Variant> = {
  CREATED: "warning",
  SENT: "info",
  PARTIALLY_RECEIVED: "info",
  RECEIVED: "success",
  CANCELLED: "neutral",
};

const PRODUCT_VARIANT: Record<keyof typeof PRODUCT_STATUS_ICON, Variant> = {
  safe: "success",
  restock: "warning",
  processing: "info",
  stockout: "destructive",
  incomplete: "warning",
};

const SUPPLIER_VARIANT: Record<keyof typeof SUPPLIER_STATUS_ICON, Variant> = {
  active: "success",
  inactive: "neutral",
  telegramConnected: "success",
  telegramDisconnected: "neutral",
  telegramPending: "warning",
};

function IconBadge({ variant, icon: Icon, children }: { variant: Variant; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Badge variant={variant}>
      <Icon {...iconProps} />
      {children}
    </Badge>
  );
}

/** Status procurement request: warna mengikuti makna (perlu tindakan, berjalan, berhasil, bermasalah, berakhir). */
export function RequestStatusBadge({ status }: { status: ProcurementStatus }) {
  return (
    <IconBadge variant={REQUEST_VARIANT[status]} icon={REQUEST_STATUS_ICON[status]}>
      {STATUS_LABEL[status]}
    </IconBadge>
  );
}

export function PoStatusBadge({ status }: { status: PoStatus }) {
  return (
    <IconBadge variant={PO_VARIANT[status]} icon={PO_STATUS_ICON[status]}>
      {PO_STATUS_LABEL[status]}
    </IconBadge>
  );
}

/** Teks lencana ditentukan pemanggil (mis. "Lengkapi: ..."); komponen ini hanya memilih ikon dan warna. */
export function ProductStatusBadge({
  kind,
  children,
}: {
  kind: keyof typeof PRODUCT_STATUS_ICON;
  children: React.ReactNode;
}) {
  return (
    <IconBadge variant={PRODUCT_VARIANT[kind]} icon={PRODUCT_STATUS_ICON[kind]}>
      {children}
    </IconBadge>
  );
}

export function SupplierStatusBadge({
  kind,
  children,
}: {
  kind: keyof typeof SUPPLIER_STATUS_ICON;
  children: React.ReactNode;
}) {
  return (
    <IconBadge variant={SUPPLIER_VARIANT[kind]} icon={SUPPLIER_STATUS_ICON[kind]}>
      {children}
    </IconBadge>
  );
}
