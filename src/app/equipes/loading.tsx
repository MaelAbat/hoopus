import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonPageBanner />

      {/* View toggle: Effectifs / Masse salariale */}
      <div className="flex gap-2">
        <div className="h-9 w-28 animate-pulse bg-input" />
        <div className="h-9 w-36 animate-pulse bg-input" />
      </div>

      {/* Team logo grid (30 teams) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 border border-rule bg-card p-4">
            <div className="h-12 w-12 animate-pulse bg-input" />
            <div className="h-3 w-16 animate-pulse bg-input" />
            <div className="h-2.5 w-10 animate-pulse bg-input" />
          </div>
        ))}
      </div>
    </div>
  );
}
