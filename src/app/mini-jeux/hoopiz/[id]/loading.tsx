import { SkeletonGameTopBar, SkeletonGameTitle } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-0 pb-8">
      <div className="space-y-4 pt-4">
        <SkeletonGameTopBar />
        <SkeletonGameTitle />
      </div>

      {/* Timer / progress bar */}
      <div className="h-10 w-full animate-pulse bg-input" />

      {/* Answer-entry table */}
      <div className="bg-card border border-rule p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="h-[62px] animate-pulse bg-input" />
          ))}
        </div>
      </div>
    </div>
  );
}
