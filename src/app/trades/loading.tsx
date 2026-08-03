import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonPageBanner extra />

      <div className="space-y-5">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2">
          <div className="h-9 w-48 animate-pulse bg-input" />
          <div className="h-9 w-36 animate-pulse bg-input" />
          <div className="h-9 w-28 animate-pulse bg-input" />
        </div>

        {/* Verdict banner */}
        <div className="relative overflow-hidden border border-rule bg-card">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-text-faint" />
          <div className="px-6 py-5">
            <div className="h-2.5 w-16 animate-pulse bg-input" />
            <div className="mt-2 h-7 w-64 animate-pulse bg-input" />
            <div className="mt-3 h-3 w-80 max-w-full animate-pulse bg-input" />
          </div>
        </div>

        {/* Two team panels */}
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border border-rule bg-card">
              <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
                <div className="h-9 w-9 animate-pulse bg-input" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-14 animate-pulse bg-input" />
                  <div className="h-2.5 w-28 animate-pulse bg-input" />
                </div>
                <div className="h-5 w-20 animate-pulse bg-input" />
              </div>

              {/* Salary flow */}
              <div className="grid grid-cols-3 divide-x divide-rule border-b border-rule">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="space-y-1.5 px-3 py-2.5">
                    <div className="mx-auto h-2.5 w-12 animate-pulse bg-input" />
                    <div className="mx-auto h-4 w-16 animate-pulse bg-input" />
                  </div>
                ))}
              </div>

              {/* Cap ladder */}
              <div className="space-y-2 border-b border-rule px-4 py-3">
                <div className="h-2.5 w-32 animate-pulse bg-input" />
                <div className="h-4 w-full animate-pulse bg-input" />
              </div>

              {/* Roster rows */}
              <div className="h-10 animate-pulse border-b border-rule bg-input/50" />
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2 border-b border-rule/60 px-3 py-2">
                  <div className="h-8 w-8 animate-pulse bg-input" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 animate-pulse bg-input" />
                    <div className="h-2.5 w-20 animate-pulse bg-input" />
                  </div>
                  <div className="h-3 w-14 animate-pulse bg-input" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
