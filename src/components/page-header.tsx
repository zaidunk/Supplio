import Link from "next/link";

/** Judul halaman seragam: ukuran h1 dibatasi supaya halaman data padat tidak kehilangan ruang. */
export function PageHeader({
  title,
  description,
  back,
  badge,
  meta,
  actions,
}: {
  title: string;
  description?: string;
  back?: { href: string; label: string };
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            {back.label}
          </Link>
        ) : null}
        <div className={`flex flex-wrap items-center gap-3 ${back ? "mt-2" : ""}`}>
          <h1 className="text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.1] font-medium tracking-[-0.025em] text-blue-700">{title}</h1>
          {badge}
        </div>
        {meta ? <p className="mt-2 text-sm text-muted-foreground">{meta}</p> : null}
        {description ? <p className="mt-2 max-w-[68ch] text-base text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
