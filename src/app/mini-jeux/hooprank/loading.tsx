import { SkeletonGameTopBar, SkeletonGameBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-0 pb-8">
      <div className="space-y-4 pt-4">
        <SkeletonGameTopBar />
        <SkeletonGameBanner />
        {/* Round progress: 5 bars */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-2 flex-1 animate-pulse bg-input" />
          ))}
        </div>
      </div>

      {/* Category pill */}
      <div className="flex justify-center">
        <div className="h-8 w-64 max-w-full animate-pulse bg-input" />
      </div>

      {/* Ranked player rows */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 bg-card border border-rule p-3 sm:gap-3">
            <div className="h-6 w-6 shrink-0 animate-pulse bg-input" />
            <div className="h-10 w-10 shrink-0 animate-pulse bg-input" />
            <div className="h-4 flex-1 animate-pulse bg-input" />
            <div className="h-5 w-5 shrink-0 animate-pulse bg-input" />
          </div>
        ))}
      </div>
    </div>
  );
}
