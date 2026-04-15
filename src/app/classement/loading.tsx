import { SkeletonBox, SkeletonTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonBox className="h-32 w-full" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-28 animate-pulse rounded-xl bg-input" />
        ))}
      </div>
      <SkeletonTable rows={15} cols={8} />
    </div>
  );
}
