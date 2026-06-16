import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonPageBanner />

      {/* Featured news */}
      <div className="overflow-hidden rounded-2xl bg-card border border-border-t">
        <div className="aspect-[21/9] animate-pulse bg-input" />
        <div className="space-y-3 p-6">
          <div className="h-4 w-28 animate-pulse rounded-full bg-input" />
          <div className="h-7 w-3/4 animate-pulse rounded bg-input" />
          <div className="h-3 w-full animate-pulse rounded bg-input" />
        </div>
      </div>

      {/* News list */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-4 overflow-hidden rounded-2xl bg-card border border-border-t sm:flex-row">
            <div className="aspect-[16/9] animate-pulse bg-input sm:aspect-auto sm:w-64 sm:shrink-0" />
            <div className="flex-1 space-y-3 p-5">
              <div className="h-4 w-24 animate-pulse rounded-full bg-input" />
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
