import { SkeletonBox } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonBox className="h-32 w-full" />
      <div className="rounded-2xl bg-card border border-border-t p-6">
        <div className="flex items-center justify-center gap-6 overflow-hidden">
          {Array.from({ length: 4 }).map((_, col) => (
            <div key={col} className="flex flex-col gap-6">
              {Array.from({ length: col === 3 ? 1 : col === 2 ? 2 : col === 1 ? 2 : 4 }).map((_, row) => (
                <div key={row} className="w-40 rounded-lg border border-border-t bg-card overflow-hidden">
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <div className="h-3 w-3 animate-pulse rounded bg-input" />
                    <div className="h-3 w-16 animate-pulse rounded bg-input" />
                  </div>
                  <div className="h-px bg-border-t" />
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <div className="h-3 w-3 animate-pulse rounded bg-input" />
                    <div className="h-3 w-16 animate-pulse rounded bg-input" />
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
