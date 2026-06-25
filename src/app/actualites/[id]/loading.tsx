export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Back link */}
      <div className="h-5 w-24 animate-pulse bg-input" />

      {/* Hero image */}
      <div className="aspect-[21/9] w-full animate-pulse border border-rule bg-input" />

      {/* Metadata */}
      <div className="flex gap-4 border-y border-rule py-3">
        <div className="h-4 w-32 animate-pulse bg-input" />
        <div className="h-4 w-24 animate-pulse bg-input" />
      </div>

      {/* Excerpt / body */}
      <div className="space-y-3 border border-rule bg-card p-5 sm:p-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`h-4 animate-pulse bg-input ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>

      {/* Other news */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex gap-3 border border-rule bg-card p-3">
            <div className="h-16 w-20 shrink-0 animate-pulse bg-input" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-full animate-pulse bg-input" />
              <div className="h-3 w-1/2 animate-pulse bg-input" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
