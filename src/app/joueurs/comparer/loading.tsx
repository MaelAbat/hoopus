import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <SkeletonPageBanner />

      {/* Back link */}
      <div className="h-4 w-32 animate-pulse bg-input" />

      {/* Player selector columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-3 bg-card border border-rule p-6">
            <div className="h-24 w-24 animate-pulse bg-input" />
            <div className="h-5 w-32 animate-pulse bg-input" />
            <div className="h-9 w-full animate-pulse bg-input" />
          </div>
        ))}
      </div>

      {/* Radar + comparison table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="aspect-square w-full animate-pulse bg-card border border-rule" />
        <div className="space-y-3 bg-card border border-rule p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-16 animate-pulse bg-input" />
              <div className="h-4 flex-1 animate-pulse bg-input" />
              <div className="h-4 w-16 animate-pulse bg-input" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
