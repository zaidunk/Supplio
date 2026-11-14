import { HeaderSkeleton, PageSkeleton, StatCardsSkeleton, TableCardSkeleton } from "@/components/skeletons";

export default function ReceivingLoading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <StatCardsSkeleton count={3} className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6" />
      <TableCardSkeleton rows={3} />
    </PageSkeleton>
  );
}
