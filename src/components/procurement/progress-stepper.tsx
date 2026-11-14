import type { ProcurementStatus } from "@/generated/prisma/enums";
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
    <ol aria-label="Progres procurement request" className="grid grid-cols-5 gap-2">
      {STEPS.map((label, i) => {
        const done = i < step.index;
        const current = i === step.index;
        return (
          <li key={label} aria-current={current ? "step" : undefined} className="flex flex-col gap-2">
            <span
              className={cn(
                "h-1.5 rounded-full",
                done && "bg-success",
                current && !step.failed && "bg-primary",
                current && step.failed && "bg-danger",
                !done && !current && "bg-line",
              )}
            />
            <span
              className={cn(
                "text-xs leading-tight sm:text-sm",
                current ? "font-medium text-foreground" : "text-muted-foreground",
                current && step.failed && "text-danger",
              )}
            >
              <span className="sr-only">{done ? "Selesai: " : current ? "Sedang berjalan: " : "Belum: "}</span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
