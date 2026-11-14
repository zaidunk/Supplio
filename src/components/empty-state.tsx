import Image from "next/image";
import { ButtonLink } from "@/components/ui/button-link";

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
        <ButtonLink href={action.href}>{action.label}</ButtonLink>
      ) : null}
    </div>
  );
}
