import * as React from "react";
import { cn } from "@/lib/utils";

/** <select> bawaan browser dengan gaya senada Input shadcn (cukup untuk MVP, tanpa dependensi tambahan). */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-input bg-surface-raised px-3.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:bg-surface-sunken disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
NativeSelect.displayName = "NativeSelect";
