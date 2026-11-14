import { HeaderSkeleton, PageSkeleton, StatCardsSkeleton, TableCardSkeleton } from "@/components/skeletons";

export default function DashboardLoading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton withAction />
      <StatCardsSkeleton count={2} className="grid gap-6 lg:grid-cols-2" />
      <StatCardsSkeleton />
      <TableCardSkeleton rows={4} />
    </PageSkeleton>
  );
}
