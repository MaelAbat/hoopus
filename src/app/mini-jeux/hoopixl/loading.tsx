import { SkeletonGameTopBar, SkeletonGameTitle } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-3 sm:px-0 pb-8">
      <div className="space-y-4 pt-4">
        <SkeletonGameTopBar />
        <SkeletonGameTitle />
      </div>

      {/* Pixelated image */}
      <div className="flex flex-col items-center gap-4">
        <div className="aspect-square w-full max-w-[280px] animate-pulse bg-input" />
        {/* Timer + guess count */}
        <div className="flex items-center gap-4">
          <div className="h-3 w-16 animate-pulse bg-input" />
          <div className="h-3 w-16 animate-pulse bg-input" />
        </div>
      </div>

      {/* Search input */}
      <div className="h-12 w-full animate-pulse bg-input" />
    </div>
  );
}
