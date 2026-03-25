export default function PageLoader() {
  return (
    <div className="mx-auto max-w-6xl animate-in fade-in duration-200">
      {/* Banner skeleton */}
      <div className="h-40 rounded-2xl bg-card border border-border-t animate-pulse mb-8" />

      {/* Content skeleton */}
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="h-9 w-28 rounded-lg bg-card animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-card animate-pulse" />
          <div className="h-9 w-28 rounded-lg bg-card animate-pulse" />
        </div>
        <div className="rounded-2xl bg-card border border-border-t p-6 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-9 w-9 rounded-full bg-input animate-pulse" />
              <div className="h-4 rounded bg-input animate-pulse" style={{ width: `${140 + (i % 3) * 40}px` }} />
              <div className="ml-auto flex gap-6">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-4 w-10 rounded bg-input animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
