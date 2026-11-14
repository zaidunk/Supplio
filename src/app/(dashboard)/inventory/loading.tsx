import { HeaderSkeleton, PageSkeleton, StatCardsSkeleton, TableCardSkeleton } from "@/components/skeletons";

export default function InventoryLoading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton withAction />
      <StatCardsSkeleton />
      <TableCardSkeleton rows={8} />
    </PageSkeleton>
  );
}
