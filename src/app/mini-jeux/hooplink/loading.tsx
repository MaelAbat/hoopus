import { SkeletonGameTopBar, SkeletonGameBanner } from "@/components/Skeleton";

function Node() {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card border border-border-t p-4">
      <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-input" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-input" />
        <div className="h-3 w-20 animate-pulse rounded bg-input" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-0 pb-8">
      <div className="space-y-4 pt-4">
        <SkeletonGameTopBar />
        <SkeletonGameBanner />
      </div>

      {/* Chain: start node → connector → end node */}
      <div className="space-y-3">
        <Node />
        <div className="flex justify-center">
          <div className="h-6 w-px animate-pulse bg-input" />
        </div>
        <Node />
      </div>

      {/* Search input */}
      <div className="h-12 w-full animate-pulse rounded-xl bg-input" />
    </div>
  );
}
