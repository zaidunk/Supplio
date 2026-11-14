import { Badge } from "@/components/ui/badge";
import type { ProcurementStatus } from "@/generated/prisma/enums";
import { PO_STATUS_LABEL, STATUS_LABEL, type PoStatus } from "@/lib/ui/status";

type Variant = NonNullable<React.ComponentProps<typeof Badge>["variant"]>;

const REQUEST_VARIANT: Record<ProcurementStatus, Variant> = {
  CONFIGURATION_REQUIRED: "destructive",
  DRAFT: "outline",
  SOURCING: "secondary",
  AWAITING_RESPONSES: "secondary",
  OPTIMIZING: "secondary",
  AWAITING_APPROVAL: "default",
  APPROVED: "success",
  ORDERED: "success",
  PARTIALLY_RECEIVED: "warning",
  COMPLETED: "success",
  NO_FEASIBLE_SOLUTION: "destructive",
  CANCELLED: "outline",
  EXPIRED: "outline",
};

const PO_VARIANT: Record<PoStatus, Variant> = {
  CREATED: "warning",
  SENT: "secondary",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELLED: "outline",
};

/** Status procurement request: warna mengikuti makna (perlu tindakan, berhasil, bermasalah, berakhir). */
export function RequestStatusBadge({ status }: { status: ProcurementStatus }) {
  return <Badge variant={REQUEST_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function PoStatusBadge({ status }: { status: PoStatus }) {
  return <Badge variant={PO_VARIANT[status]}>{PO_STATUS_LABEL[status]}</Badge>;
}
