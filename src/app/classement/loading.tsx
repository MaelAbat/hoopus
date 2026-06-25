import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonPageBanner extra />

      <div className="space-y-6">
        {/* View tabs: Est / Ouest / Ligue / Divisions */}
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-24 animate-pulse bg-input" />
          ))}
        </div>

        {/* Standings card */}
        <div className="border border-rule bg-card overflow-hidden">
          {/* Card header: conference name + team count */}
          <div className="flex items-center justify-between border-b border-rule px-4 py-4 sm:px-6">
            <div className="h-5 w-40 animate-pulse bg-input" />
            <div className="h-4 w-16 animate-pulse bg-input" />
          </div>
          {/* Table header row */}
          <div className="flex items-center gap-3 border-b border-rule px-4 py-3 sm:px-6">
            <div className="h-3 w-6 animate-pulse bg-input" />
            <div className="h-3 w-32 animate-pulse bg-input" />
            <div className="ml-auto flex gap-4">
              {Array.from({ length: 8 }).map((_, j) => (
                <div key={j} className="h-3 w-7 animate-pulse bg-input" />
              ))}
            </div>
          </div>
          {/* 15 team rows */}
          <div className="divide-y divide-rule">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                <div className="h-4 w-6 shrink-0 animate-pulse bg-input" />
                <div className="h-6 w-6 shrink-0 animate-pulse bg-input" />
                <div className="h-4 w-28 animate-pulse bg-input" />
                <div className="ml-auto flex gap-4">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <div key={j} className="h-4 w-7 animate-pulse bg-input" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Legend footer */}
          <div className="flex flex-wrap gap-4 border-t border-rule px-4 py-3 sm:gap-6 sm:px-6">
            <div className="h-3 w-28 animate-pulse bg-input" />
            <div className="h-3 w-28 animate-pulse bg-input" />
          </div>
        </div>
      </div>
    </div>
  );
}
