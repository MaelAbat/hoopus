import { SkeletonGameTopBar, SkeletonGameTitle } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-3 sm:px-0 pb-8">
      <div className="space-y-4 pt-4">
        <SkeletonGameTopBar />
        <SkeletonGameTitle />
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="h-3 w-16 animate-pulse bg-input" />
            <div className="h-3 w-12 animate-pulse bg-input" />
          </div>
          <div className="h-1.5 w-full animate-pulse bg-input" />
        </div>
      </div>

      {/* Word list sidebar + letter grid */}
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="hidden w-44 flex-col gap-1.5 lg:flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse bg-input" />
          ))}
        </div>
        <div className="min-w-0 flex-1 border border-rule bg-card p-2 sm:p-3">
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(10, 1fr)" }}>
            {Array.from({ length: 100 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse bg-input" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
