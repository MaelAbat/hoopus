import { SkeletonBox } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonBox className="h-32 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-card border border-border-t p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 animate-pulse rounded bg-input" />
              <div className="h-4 w-16 animate-pulse rounded bg-input" />
            </div>
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 animate-pulse rounded-full bg-input" />
                <div className="h-5 w-10 animate-pulse rounded bg-input" />
              </div>
              <div className="h-6 w-12 animate-pulse rounded bg-input" />
              <div className="flex items-center gap-2">
                <div className="h-5 w-10 animate-pulse rounded bg-input" />
                <div className="h-8 w-8 animate-pulse rounded-full bg-input" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
