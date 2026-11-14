import { HeaderSkeleton, PageSkeleton, StatCardsSkeleton, TableCardSkeleton } from "@/components/skeletons";

export default function ProcurementLoading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <StatCardsSkeleton />
      <TableCardSkeleton rows={6} />
    </PageSkeleton>
  );
}
