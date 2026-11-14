import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { iconProps } from "@/lib/ui/icons";

/** <select> bawaan browser dengan gaya senada Input shadcn (cukup untuk MVP, tanpa dependensi tambahan). */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none rounded-xl border border-input bg-surface-raised pr-9 pl-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:bg-surface-sunken disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <ChevronDown
        {...iconProps}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  ),
);
NativeSelect.displayName = "NativeSelect";
