import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Keadaan kosong dengan satu langkah berikutnya, bukan hanya teks abu-abu. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="font-medium">{title}</p>
      {description ? <p className="max-w-[52ch] text-sm text-muted-foreground">{description}</p> : null}
      {action ? (
        <Link href={action.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
