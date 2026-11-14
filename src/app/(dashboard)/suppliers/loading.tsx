import { HeaderSkeleton, PageSkeleton, StatCardsSkeleton, TableCardSkeleton } from "@/components/skeletons";

export default function SuppliersLoading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton withAction />
      <StatCardsSkeleton />
      <TableCardSkeleton rows={3} />
    </PageSkeleton>
  );
}
