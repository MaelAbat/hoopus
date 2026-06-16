import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonPageBanner extra />

      {/* View toggle: Playoffs / Play-In / Statistiques */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-28 animate-pulse rounded-xl bg-input" />
        ))}
      </div>

      {/* Bracket card */}
      <div className="rounded-2xl bg-card border border-border-t p-3 sm:p-6">
        <div className="flex items-center justify-center gap-6 overflow-hidden sm:gap-10">
          {[4, 2, 1, 2].map((rows, col) => (
            <div key={col} className="flex flex-col gap-6">
              {Array.from({ length: rows }).map((_, row) => (
                <div key={row} className="w-36 overflow-hidden rounded-lg border border-border-t sm:w-44">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="h-5 w-5 animate-pulse rounded-full bg-input" />
                    <div className="h-3 w-16 animate-pulse rounded bg-input" />
                    <div className="ml-auto h-3 w-4 animate-pulse rounded bg-input" />
                  </div>
                  <div className="h-px bg-border-t" />
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="h-5 w-5 animate-pulse rounded-full bg-input" />
                    <div className="h-3 w-16 animate-pulse rounded bg-input" />
                    <div className="ml-auto h-3 w-4 animate-pulse rounded bg-input" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
