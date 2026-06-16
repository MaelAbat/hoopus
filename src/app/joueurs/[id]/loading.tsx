export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Back link */}
      <div className="h-5 w-32 animate-pulse rounded bg-input" />

      {/* Hero card */}
      <div className="rounded-2xl bg-card border border-border-t p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
          <div className="h-40 w-48 shrink-0 animate-pulse rounded-2xl bg-input" />
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div className="mx-auto h-4 w-24 animate-pulse rounded bg-input sm:mx-0" />
            <div className="mx-auto h-9 w-56 animate-pulse rounded-lg bg-input sm:mx-0" />
            <div className="mx-auto flex gap-2 sm:mx-0">
              <div className="h-6 w-16 animate-pulse rounded-full bg-input" />
              <div className="h-6 w-16 animate-pulse rounded-full bg-input" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-input" />
            </div>
          </div>
        </div>
      </div>

      {/* Stat highlights */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl bg-card border border-border-t p-5 text-center">
            <div className="mx-auto h-8 w-16 animate-pulse rounded bg-input" />
            <div className="mx-auto h-3 w-20 animate-pulse rounded bg-input" />
          </div>
        ))}
      </div>

      {/* Bio info */}
      <div className="space-y-4 rounded-2xl bg-card border border-border-t p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-5 w-5 animate-pulse rounded bg-input" />
            <div className="h-4 w-32 animate-pulse rounded bg-input" />
            <div className="ml-auto h-4 w-24 animate-pulse rounded bg-input" />
          </div>
        ))}
      </div>

      {/* Career table */}
      <div className="rounded-2xl bg-card border border-border-t p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="h-4 w-12 animate-pulse rounded bg-input" />
            <div className="h-4 flex-1 animate-pulse rounded bg-input" />
            <div className="ml-auto flex gap-4">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-4 w-10 animate-pulse rounded bg-input" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
