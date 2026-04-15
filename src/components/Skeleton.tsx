export function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-input ${className}`} />;
}

export function SkeletonText({ className = "", lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-3 animate-pulse rounded-md bg-input ${i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"}`} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 10, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
      <div className="px-6 py-4 border-b border-border-t">
        <div className="h-5 w-40 animate-pulse rounded-md bg-input" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className={`h-4 animate-pulse rounded bg-input ${c === 0 ? "w-8" : c === 1 ? "flex-1" : "w-12"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-card border border-border-t overflow-hidden">
          <div className="h-36 animate-pulse bg-input" />
          <div className="p-5 space-y-3">
            <div className="h-5 w-3/4 animate-pulse rounded bg-input" />
            <div className="h-3 w-full animate-pulse rounded bg-input" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-input" />
          </div>
        </div>
      ))}
    </div>
  );
}
