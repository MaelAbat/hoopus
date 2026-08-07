import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonPageBanner extra />

      <div className="space-y-6">
        {/* Synthèse */}
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="min-w-[130px] flex-1 border border-rule bg-card px-4 py-3">
              <div className="h-8 w-14 animate-pulse bg-input" />
              <div className="mt-2 h-2.5 w-20 animate-pulse bg-input" />
            </div>
          ))}
        </div>

        {/* Frise des périodes */}
        <div className="border border-rule bg-card">
          <div className="border-b border-rule bg-input/50 px-4 py-2.5">
            <div className="h-2.5 w-40 animate-pulse bg-input" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="border-b border-rule px-3 py-3 lg:border-b-0">
                <div className="h-2.5 w-16 animate-pulse bg-input" />
                <div className="mt-2 h-6 w-10 animate-pulse bg-input" />
                <div className="mt-1 h-2 w-20 animate-pulse bg-input" />
              </div>
            ))}
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          <div className="h-9 w-56 animate-pulse bg-input" />
          <div className="h-9 w-28 animate-pulse bg-input" />
          <div className="h-9 w-32 animate-pulse bg-input" />
        </div>

        {/* Bilan par équipe */}
        <div className="border border-rule bg-card">
          <div className="border-b border-rule bg-input/50 px-4 py-2.5">
            <div className="h-2.5 w-32 animate-pulse bg-input" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-t border-rule px-4 py-2.5">
              <div className="h-5 w-5 animate-pulse rounded-full bg-input" />
              <div className="h-3 w-28 animate-pulse bg-input" />
              <div className="ml-auto flex gap-6">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="h-3 w-6 animate-pulse bg-input" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Chronologie */}
        <div className="border border-rule bg-card">
          <div className="border-b border-rule bg-input/50 px-4 py-2.5">
            <div className="h-2.5 w-24 animate-pulse bg-input" />
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 border-t border-rule px-4 py-3">
              <div className="h-2.5 w-16 shrink-0 animate-pulse bg-input" />
              <div className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-input" />
              <div className="h-3 flex-1 animate-pulse bg-input" style={{ maxWidth: `${70 - i * 3}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
