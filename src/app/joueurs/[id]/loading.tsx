export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Back link */}
      <div className="h-5 w-32 animate-pulse bg-input" />

      {/* Hero card */}
      <div className="relative overflow-hidden bg-card border border-rule p-6 sm:p-8">
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent/40" />
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="h-44 w-44 shrink-0 animate-pulse bg-input" />
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div className="mx-auto h-3 w-24 animate-pulse bg-input sm:mx-0" />
            <div className="mx-auto h-12 w-56 animate-pulse bg-input sm:mx-0" />
            <div className="mx-auto flex gap-2 sm:mx-0">
              <div className="h-6 w-16 animate-pulse bg-input" />
              <div className="h-6 w-16 animate-pulse bg-input" />
              <div className="h-6 w-20 animate-pulse bg-input" />
            </div>
          </div>
        </div>
      </div>

      {/* Stat highlights */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 bg-card border border-rule p-5 text-center">
            <div className="mx-auto h-8 w-16 animate-pulse bg-input" />
            <div className="mx-auto h-3 w-20 animate-pulse bg-input" />
          </div>
        ))}
      </div>

      {/* Bio info */}
      <div className="space-y-4 bg-card border border-rule p-6 sm:p-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse bg-input" />
            <div className="h-4 w-32 animate-pulse bg-input" />
            <div className="ml-auto h-4 w-24 animate-pulse bg-input" />
          </div>
        ))}
      </div>

      {/* Career table */}
      <div className="bg-card border border-rule p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="h-4 w-12 animate-pulse bg-input" />
            <div className="h-4 flex-1 animate-pulse bg-input" />
            <div className="ml-auto flex gap-4">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-4 w-10 animate-pulse bg-input" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
