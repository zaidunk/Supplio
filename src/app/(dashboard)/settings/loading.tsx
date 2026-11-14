import { HeaderSkeleton, PageSkeleton, TextCardSkeleton } from "@/components/skeletons";

export default function SettingsLoading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <TextCardSkeleton lines={3} />
        <TextCardSkeleton lines={4} />
      </div>
    </PageSkeleton>
  );
}
