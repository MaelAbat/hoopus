import { SkeletonGameTopBar, SkeletonGameBanner } from "@/components/Skeleton";

function PlayerCard() {
  return (
    <div className="flex flex-1 flex-col items-center gap-3 rounded-2xl bg-card border border-border-t p-5">
      <div className="h-24 w-24 animate-pulse rounded-full bg-input" />
      <div className="h-5 w-28 animate-pulse rounded bg-input" />
      <div className="h-3 w-20 animate-pulse rounded bg-input" />
      <div className="h-8 w-16 animate-pulse rounded-lg bg-input" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-0 pb-8">
      <div className="space-y-4 pt-4">
        <SkeletonGameTopBar />
        {/* Mode tabs */}
        <div className="flex gap-1 rounded-xl bg-input p-1">
          <div className="h-9 flex-1 animate-pulse rounded-lg bg-card" />
          <div className="h-9 flex-1 animate-pulse rounded-lg bg-card" />
        </div>
        <SkeletonGameBanner />
      </div>

      {/* Two comparison cards + center controls */}
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:gap-6">
        <PlayerCard />
        <div className="flex flex-row items-center justify-center gap-3 sm:flex-col">
          <div className="h-10 w-16 animate-pulse rounded-lg bg-input" />
          <div className="h-10 w-16 animate-pulse rounded-lg bg-input" />
        </div>
        <PlayerCard />
      </div>
    </div>
  );
}
