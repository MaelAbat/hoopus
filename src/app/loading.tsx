export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border-t bg-card sm:rounded-3xl">
        <div className="space-y-4 px-6 py-10 sm:px-10 sm:py-20">
          <div className="h-6 w-32 animate-pulse rounded-full bg-input" />
          <div className="h-10 w-3/4 animate-pulse rounded-lg bg-input sm:h-12" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-input" />
          <div className="flex gap-3 pt-2">
            <div className="h-11 w-36 animate-pulse rounded-xl bg-input" />
            <div className="h-11 w-36 animate-pulse rounded-xl bg-input" />
          </div>
        </div>
      </div>

      {/* Featured article */}
      <div className="overflow-hidden rounded-2xl bg-card border border-border-t lg:flex">
        <div className="aspect-[16/9] animate-pulse bg-input lg:w-1/2" />
        <div className="space-y-3 p-6 lg:w-1/2">
          <div className="h-4 w-24 animate-pulse rounded-full bg-input" />
          <div className="h-6 w-3/4 animate-pulse rounded bg-input" />
          <div className="h-3 w-full animate-pulse rounded bg-input" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-input" />
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl bg-card border border-border-t p-5">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-input" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-input" />
            <div className="h-3 w-full animate-pulse rounded bg-input" />
          </div>
        ))}
      </div>
    </div>
  );
}
