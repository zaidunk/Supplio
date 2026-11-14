import { JellyLink } from "@/components/jelly-link";
import { cn } from "@/lib/utils";

/**
 * Kartu angka ringkasan. `featured` memakai gradien biru (kartu sorotan Dashboard).
 * Tanpa `href` kartu tidak bisa diklik (ringkasan murni).
 */
export function StatCard({
  label,
  value,
  href,
  featured = false,
  className,
}: {
  label: string;
  value: string | number;
  href?: string;
  featured?: boolean;
  className?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col gap-1 rounded-xl border p-5 transition-all",
        featured
          ? "border-transparent bg-[image:var(--grad-blue)] text-white shadow-md"
          : "border-line bg-card",
      )}
    >
      <span className={cn("text-sm", featured ? "text-blue-100" : "text-muted-foreground")}>{label}</span>
      <span className="text-[28px] leading-8 font-medium tracking-[-0.02em] tabular-nums">{value}</span>
    </div>
  );

  return href ? (
    <JellyLink href={href} motion="card" className={cn("block", className)}>
      {body}
    </JellyLink>
  ) : (
    <div className={className}>{body}</div>
  );
}
