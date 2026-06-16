import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonPageBanner />

      {/* Daily challenge banner */}
      <div className="rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/10 via-card to-card px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-input" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 animate-pulse rounded-md bg-input" />
            <div className="h-3 w-full max-w-lg animate-pulse rounded bg-input" />
          </div>
          <div className="hidden gap-4 sm:flex">
            <div className="h-4 w-24 animate-pulse rounded bg-input" />
            <div className="h-4 w-28 animate-pulse rounded bg-input" />
          </div>
        </div>
      </div>

      {/* Games grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-card border border-border-t">
            {/* Preview area */}
            <div className="h-28 animate-pulse bg-input" />
            <div className="space-y-3 p-6">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-input" />
                <div className="space-y-2">
                  <div className="h-5 w-28 animate-pulse rounded bg-input" />
                  <div className="flex gap-1.5">
                    <div className="h-4 w-14 animate-pulse rounded-full bg-input" />
                    <div className="h-4 w-14 animate-pulse rounded-full bg-input" />
                  </div>
                </div>
              </div>
              <div className="h-3 w-full animate-pulse rounded bg-input" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-input" />
              <div className="h-4 w-32 animate-pulse rounded bg-input" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
