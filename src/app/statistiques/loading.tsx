import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <SkeletonPageBanner extra />

      <div className="space-y-6">
        {/* Section tabs: Joueurs / Équipes + view-mode sub-tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-1 rounded-xl bg-card border border-border-t p-1">
            <div className="h-8 w-24 animate-pulse rounded-lg bg-input" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-input" />
          </div>
          <div className="flex gap-0.5 rounded-lg bg-input p-0.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-7 w-28 animate-pulse rounded-md bg-card" />
            ))}
          </div>
        </div>

        {/* Carousel: arrows + tall leaderboard card */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:block h-10 w-10 shrink-0 animate-pulse rounded-full bg-card" />
          <div className="flex-1 min-w-0 rounded-2xl bg-card border border-border-t overflow-hidden">
            {/* Category tab strip */}
            <div className="flex gap-1.5 overflow-hidden border-b border-border-t px-3 py-3 sm:px-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-7 w-20 shrink-0 animate-pulse rounded-lg bg-input" />
              ))}
            </div>
            {/* Controls bar */}
            <div className="flex items-center gap-2 border-b border-border-t/50 px-3 py-2.5 sm:px-6">
              <div className="h-7 w-28 animate-pulse rounded-lg bg-input" />
              <div className="h-7 w-24 animate-pulse rounded-lg bg-input" />
              <div className="ml-auto h-7 w-40 animate-pulse rounded-lg bg-input" />
            </div>
            {/* Player rows */}
            <div className="divide-y divide-border-t/30">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 sm:px-6">
                  <div className="h-6 w-6 shrink-0 animate-pulse rounded-md bg-input" />
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-input" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-input" style={{ maxWidth: `${160 + (i % 3) * 40}px` }} />
                  <div className="ml-auto h-5 w-12 animate-pulse rounded bg-input" />
                </div>
              ))}
            </div>
          </div>
          <div className="hidden sm:block h-10 w-10 shrink-0 animate-pulse rounded-full bg-card" />
        </div>
      </div>
    </div>
  );
}
