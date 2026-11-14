import Image from "next/image";
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
      <Image src="/brand/icon.svg" alt="" width={96} height={92} />
      <p className="text-xl font-medium text-blue-700">{title}</p>
      {description ? <p className="max-w-[360px] text-sm text-muted-foreground">{description}</p> : null}
      {action ? (
        <Link href={action.href} className={buttonVariants()}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
