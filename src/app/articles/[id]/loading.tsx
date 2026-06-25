export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Back link */}
      <div className="h-5 w-24 animate-pulse bg-input" />

      {/* Hero image */}
      <div className="aspect-[21/9] w-full animate-pulse border border-rule bg-input" />

      {/* Metadata bar */}
      <div className="flex gap-4 border-y border-rule py-3">
        <div className="h-4 w-28 animate-pulse bg-input" />
        <div className="h-4 w-24 animate-pulse bg-input" />
        <div className="h-4 w-20 animate-pulse bg-input" />
      </div>

      {/* Excerpt with accent border */}
      <div className="space-y-2 border-l-4 border-accent pl-4">
        <div className="h-5 w-full animate-pulse bg-input" />
        <div className="h-5 w-2/3 animate-pulse bg-input" />
      </div>

      {/* Article body */}
      <div className="space-y-3 border border-rule bg-card p-5 sm:p-8">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={`h-4 animate-pulse bg-input ${i % 4 === 3 ? "w-1/2" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}
