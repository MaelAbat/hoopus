import { SkeletonBox, SkeletonCards } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonBox className="h-32 w-full" />
      <SkeletonCards count={7} />
    </div>
  );
}
