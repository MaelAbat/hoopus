import { SkeletonGameTopBar, SkeletonGameTitle } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-0 pb-8">
      <div className="space-y-4 pt-4">
        <SkeletonGameTopBar />
        <SkeletonGameTitle />
      </div>

      {/* Search bar */}
      <div className="h-11 w-full animate-pulse rounded-xl bg-input" />

      {/* Quiz card grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-card border border-border-t">
            <div className="h-32 w-full animate-pulse bg-input" />
            <div className="space-y-2 p-5">
              <div className="h-5 w-3/4 animate-pulse rounded bg-input" />
              <div className="h-3 w-full animate-pulse rounded bg-input" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-input" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
