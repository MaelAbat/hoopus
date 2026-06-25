import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <SkeletonPageBanner extra />

      <div className="space-y-6">
        {/* Section tabs: Joueurs / Équipes + view-mode sub-tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex border border-rule bg-card">
            <div className="h-9 w-24 animate-pulse bg-input" />
            <div className="h-9 w-24 animate-pulse bg-input" />
          </div>
          <div className="flex gap-px border border-rule bg-input">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-7 w-28 animate-pulse bg-card" />
            ))}
          </div>
        </div>

        {/* Carousel: arrows + tall leaderboard card */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:block h-10 w-10 shrink-0 animate-pulse border border-rule bg-card" />
          <div className="flex-1 min-w-0 border border-rule bg-card overflow-hidden">
            {/* Category tab strip */}
            <div className="flex gap-1.5 overflow-hidden border-b border-rule px-3 py-3 sm:px-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-7 w-20 shrink-0 animate-pulse bg-input" />
              ))}
            </div>
            {/* Controls bar */}
            <div className="flex items-center gap-2 border-b border-rule px-3 py-2.5 sm:px-6">
              <div className="h-7 w-28 animate-pulse bg-input" />
              <div className="h-7 w-24 animate-pulse bg-input" />
              <div className="ml-auto h-7 w-40 animate-pulse bg-input" />
            </div>
            {/* Header row */}
            <div className="flex items-center justify-between border-b border-rule px-3 py-3 sm:px-6">
              <div className="h-3 w-14 animate-pulse bg-input" />
              <div className="h-3 w-10 animate-pulse bg-input" />
            </div>
            {/* Player rows */}
            <div className="divide-y divide-rule">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3.5 sm:px-6">
                  <div className="h-8 w-8 shrink-0 animate-pulse bg-input" />
                  <div className="h-10 w-10 shrink-0 animate-pulse bg-input" />
                  <div className="h-4 flex-1 animate-pulse bg-input" style={{ maxWidth: `${160 + (i % 3) * 40}px` }} />
                  <div className="ml-auto h-6 w-12 animate-pulse bg-input" />
                </div>
              ))}
            </div>
          </div>
          <div className="hidden sm:block h-10 w-10 shrink-0 animate-pulse border border-rule bg-card" />
        </div>
      </div>
    </div>
  );
}
