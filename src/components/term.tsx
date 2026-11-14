/** Istilah baku (SUPPLIO.md §2) tetap dipakai apa adanya; penjelasan singkatnya muncul saat disorot. */
export function Term({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <abbr title={hint} className="cursor-help no-underline decoration-dotted underline-offset-4 hover:underline">
      {children}
    </abbr>
  );
}
