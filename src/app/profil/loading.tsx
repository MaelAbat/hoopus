export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Title */}
      <div className="space-y-2">
        <div className="h-9 w-32 animate-pulse bg-input" />
        <div className="h-4 w-64 animate-pulse bg-input/30" />
      </div>

      {/* User card */}
      <div className="border border-rule bg-card p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="h-20 w-20 animate-pulse bg-input" />
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <div className="mx-auto h-6 w-40 animate-pulse bg-input sm:mx-0" />
            <div className="mx-auto h-3 w-56 animate-pulse bg-input/30 sm:mx-0" />
          </div>
          <div className="h-9 w-28 animate-pulse bg-input" />
        </div>
      </div>

      {/* Section cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-4 border border-rule bg-card p-6">
          <div className="h-5 w-40 animate-pulse bg-input" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-16 animate-pulse bg-input/30" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
