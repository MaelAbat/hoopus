import { SkeletonBox, SkeletonTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SkeletonBox className="h-32 w-full" />
      <SkeletonTable rows={12} cols={8} />
    </div>
  );
}
