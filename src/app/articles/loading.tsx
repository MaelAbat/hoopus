import { SkeletonPageBanner } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonPageBanner />

      {/* Articles grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden border border-rule bg-card">
            <div className="aspect-[16/9] animate-pulse bg-input" />
            <div className="space-y-3 p-5 sm:p-6">
              <div className="h-5 w-3/4 animate-pulse bg-input" />
              <div className="h-3 w-full animate-pulse bg-input" />
              <div className="h-3 w-5/6 animate-pulse bg-input" />
              <div className="flex gap-3 border-t border-rule pt-4">
                <div className="h-3 w-20 animate-pulse bg-input" />
                <div className="h-3 w-16 animate-pulse bg-input" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
