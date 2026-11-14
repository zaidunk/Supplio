import type { ProcurementStatus } from "@/generated/prisma/enums";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { iconProps } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const STEPS = ["Cari penawaran", "Hitung kombinasi", "Persetujuan", "Pesanan", "Penerimaan"];

/** Indeks langkah yang sedang berjalan; STEPS.length berarti semua selesai. Null = request berakhir tanpa jalur normal. */
function currentStep(status: ProcurementStatus): { index: number; failed?: boolean } | null {
  switch (status) {
    case "CONFIGURATION_REQUIRED":
    case "DRAFT":
    case "SOURCING":
    case "AWAITING_RESPONSES":
      return { index: 0 };
    case "OPTIMIZING":
      return { index: 1 };
    case "NO_FEASIBLE_SOLUTION":
      return { index: 1, failed: true };
    case "AWAITING_APPROVAL":
      return { index: 2 };
    case "APPROVED":
      return { index: 3 };
    case "ORDERED":
    case "PARTIALLY_RECEIVED":
      return { index: 4 };
    case "COMPLETED":
      return { index: STEPS.length };
    case "CANCELLED":
    case "EXPIRED":
      return null;
  }
}

export function ProgressStepper({ status }: { status: ProcurementStatus }) {
  const step = currentStep(status);
  if (!step) return null;

  return (
    <Card>
      <CardContent>
    <ol aria-label="Progres procurement request" className="grid grid-cols-5">
      {STEPS.map((label, i) => {
        const done = i < step.index;
        const current = i === step.index;
        const failed = current && step.failed;
        return (
          <li key={label} aria-current={current ? "step" : undefined} className="relative flex flex-col items-center gap-2 text-center">
            {i > 0 ? (
              <span
                aria-hidden="true"
                className={cn("absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2", i <= step.index ? "bg-success" : "bg-line")}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-sm font-medium tabular-nums",
                done && "border-success bg-success text-white",
                current && !failed && "border-primary bg-surface-raised text-primary",
                failed && "border-danger bg-danger-bg text-danger",
                !done && !current && "border-line bg-surface-raised text-ink-subtle",
              )}
            >
              {done ? <Check {...iconProps} /> : failed ? <X {...iconProps} /> : i + 1}
            </span>
            <span
              className={cn(
                "min-w-0 px-0.5 text-[11px] leading-tight break-words sm:px-0 sm:text-sm",
                current ? "font-medium text-foreground" : "text-muted-foreground",
                failed && "text-danger",
              )}
            >
              <span className="sr-only">{done ? "Selesai: " : current ? "Sedang berjalan: " : "Belum: "}</span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
      </CardContent>
    </Card>
  );
}
