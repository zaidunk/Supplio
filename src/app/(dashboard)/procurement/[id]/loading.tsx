import { HeaderSkeleton, PageSkeleton, TableCardSkeleton, TextCardSkeleton } from "@/components/skeletons";

export default function ProcurementDetailLoading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <TextCardSkeleton lines={1} />
      <TableCardSkeleton rows={4} />
    </PageSkeleton>
  );
}
