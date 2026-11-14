/** Label membungkus kontrolnya sehingga terhubung otomatis (aksesibilitas) tanpa perlu id. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium leading-5">{label}</span>
      {children}
      {hint ? <span className="text-[0.8125rem] leading-5 text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function FormMessage({ error, info }: { error?: string | null; info?: string | null }) {
  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  return info ? <p className="text-sm text-muted-foreground">{info}</p> : null;
}
