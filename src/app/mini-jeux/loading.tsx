import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonPageBanner />

      {/* Daily challenge banner */}
      <div className="relative overflow-hidden border border-rule bg-card px-6 py-6 sm:px-8 sm:py-8">
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="h-14 w-14 shrink-0 animate-pulse border border-rule bg-input" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse bg-input" />
            <div className="h-3 w-full max-w-lg animate-pulse bg-input" />
          </div>
          <div className="hidden gap-4 sm:flex">
            <div className="h-4 w-24 animate-pulse bg-input" />
            <div className="h-4 w-28 animate-pulse bg-input" />
          </div>
        </div>
      </div>

      {/* Games grid */}
      <div className="grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-card">
            {/* Preview area */}
            <div className="h-28 animate-pulse border-b border-rule bg-input" />
            <div className="space-y-3 p-6">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 shrink-0 animate-pulse border border-rule bg-input" />
                <div className="space-y-2">
                  <div className="h-5 w-28 animate-pulse bg-input" />
                  <div className="flex gap-1.5">
                    <div className="h-4 w-14 animate-pulse bg-input" />
                    <div className="h-4 w-14 animate-pulse bg-input" />
                  </div>
                </div>
              </div>
              <div className="h-3 w-full animate-pulse bg-input" />
              <div className="h-3 w-2/3 animate-pulse bg-input" />
              <div className="h-4 w-32 animate-pulse bg-input" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
