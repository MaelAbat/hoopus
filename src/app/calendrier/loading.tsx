import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonPageBanner extra />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
        {/* Calendar */}
        <div className="flex flex-col bg-card border border-rule p-5">
          {/* Month nav */}
          <div className="mb-4 flex items-center justify-between">
            <div className="h-8 w-8 animate-pulse bg-input" />
            <div className="h-5 w-40 animate-pulse bg-input" />
            <div className="h-8 w-8 animate-pulse bg-input" />
          </div>
          {/* Day-of-week labels */}
          <div className="mb-1 grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-3 animate-pulse bg-input" />
            ))}
          </div>
          {/* 6 weeks × 7 days */}
          <div className="grid flex-1 grid-cols-7 gap-1">
            {Array.from({ length: 42 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse bg-input" />
            ))}
          </div>
        </div>

        {/* Games side panel (desktop only) */}
        <div className="hidden flex-col lg:flex">
          <div className="mb-3 h-4 w-40 animate-pulse bg-input" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card border border-rule p-3">
                <div className="mb-2 h-3 w-16 animate-pulse bg-input" />
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, r) => (
                    <div key={r} className="flex items-center gap-2">
                      <div className="h-6 w-6 animate-pulse bg-input" />
                      <div className="h-3 flex-1 animate-pulse bg-input" />
                      <div className="h-4 w-6 animate-pulse bg-input" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
