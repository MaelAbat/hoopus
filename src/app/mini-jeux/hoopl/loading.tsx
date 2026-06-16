import { SkeletonGameTopBar, SkeletonGameBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-0 pb-8">
      <div className="space-y-4 pt-4">
        <SkeletonGameTopBar />
        <SkeletonGameBanner />
      </div>
      {/* Search input */}
      <div className="h-12 w-full animate-pulse rounded-xl bg-input" />
    </div>
  );
}
