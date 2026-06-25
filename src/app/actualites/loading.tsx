import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonPageBanner />

      {/* Featured news */}
      <div className="relative overflow-hidden border border-rule bg-card">
        <span className="absolute left-0 top-0 bottom-0 z-10 w-1 bg-accent" />
        <div className="aspect-[21/9] animate-pulse bg-input" />
        <div className="space-y-3 p-6 sm:p-8">
          <div className="h-7 w-3/4 animate-pulse bg-input" />
          <div className="h-3 w-full animate-pulse bg-input" />
        </div>
      </div>

      {/* News list */}
      <div className="border-t border-rule">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-4 overflow-hidden border-b border-rule bg-card sm:flex-row">
            <div className="aspect-[16/9] animate-pulse bg-input sm:aspect-auto sm:w-40 sm:shrink-0" />
            <div className="flex-1 space-y-3 p-4 sm:p-6">
              <div className="h-4 w-24 animate-pulse bg-input" />
              <div className="h-5 w-3/4 animate-pulse bg-input" />
              <div className="h-3 w-full animate-pulse bg-input" />
              <div className="h-3 w-2/3 animate-pulse bg-input" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
