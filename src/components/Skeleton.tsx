export function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-input ${className}`} />;
}

// Mirrors the real PageBanner: a bordered card (not a flat grey block) with the
// left accent bar + bottom accent line, so the skeleton matches the destination
// header instead of a generic box. `extra` renders the optional row that some
// banners carry (e.g. a season selector).
export function SkeletonPageBanner({ extra = false }: { extra?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-t bg-card">
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: "linear-gradient(to bottom, var(--accent), var(--accent) 40%, transparent)" }}
      />
      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(to right, var(--accent), transparent 60%)" }}
      />
      <div className="relative px-8 py-10 sm:px-10 sm:py-12">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-input sm:h-10" />
        <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-input" />
        {extra && <div className="mt-4 h-9 w-44 animate-pulse rounded-lg bg-input" />}
      </div>
    </div>
  );
}

// Back-to-games link pill shared by every mini-game header.
export function SkeletonGameTopBar() {
  return (
    <div className="flex items-center justify-between">
      <div className="h-10 w-44 animate-pulse rounded-lg bg-input sm:h-7 sm:w-36" />
    </div>
  );
}

// Horizontal game banner: circular icon + title + subtitle + stat pills.
// Used by Hoopl, HoopRank, HoopLink, HoopMore.
export function SkeletonGameBanner() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-t bg-card">
      <div className="px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-input sm:h-20 sm:w-20" />
          <div className="flex-1 space-y-2">
            <div className="h-7 w-40 animate-pulse rounded bg-input sm:h-8" />
            <div className="h-3.5 w-56 max-w-full animate-pulse rounded bg-input" />
            <div className="flex gap-2 pt-1">
              <div className="h-5 w-16 animate-pulse rounded-full bg-input" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-input" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Centered title + subtitle. Used by HoopGrid, Hoopixl, Hoopiz.
export function SkeletonGameTitle() {
  return (
    <div className="space-y-2 text-center">
      <div className="mx-auto h-8 w-40 animate-pulse rounded bg-input" />
      <div className="mx-auto h-4 w-56 max-w-full animate-pulse rounded bg-input" />
    </div>
  );
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
