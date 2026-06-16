import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <SkeletonPageBanner />

      {/* Filter bar: search + dropdowns */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-10 w-full max-w-md animate-pulse rounded-xl bg-input" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-lg bg-input" />
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-9 animate-pulse rounded-lg bg-input" />
        ))}
      </div>

      {/* Player card grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-card border border-border-t">
            <div className="aspect-[4/3] animate-pulse bg-input" />
            <div className="space-y-2 px-3 py-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-input" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-input" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
