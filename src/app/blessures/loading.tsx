import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonPageBanner />

      {/* Summary stat cards */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="min-w-[130px] flex-1 rounded-xl bg-card border border-border-t px-4 py-3">
            <div className="h-6 w-10 animate-pulse rounded bg-input" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded bg-input" />
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-9 min-w-[180px] max-w-xs flex-1 animate-pulse rounded-lg bg-input" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-input" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-input" />
      </div>

      {/* Team injury sections */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, s) => (
          <div key={s} className="overflow-hidden rounded-xl bg-card border border-border-t">
            {/* Section header */}
            <div className="flex items-center gap-3 bg-input/50 px-4 py-3">
              <div className="h-7 w-7 animate-pulse rounded-full bg-input" />
              <div className="h-4 w-32 animate-pulse rounded bg-input" />
              <div className="ml-auto h-4 w-8 animate-pulse rounded bg-input" />
            </div>
            {/* Injury rows */}
            <div className="divide-y divide-border-t/30">
              {Array.from({ length: 3 }).map((_, r) => (
                <div key={r} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-4 flex-1 animate-pulse rounded bg-input" />
                  <div className="hidden h-4 w-28 animate-pulse rounded bg-input sm:block" />
                  <div className="hidden h-4 w-20 animate-pulse rounded bg-input sm:block" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-input" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
