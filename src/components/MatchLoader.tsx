export default function MatchLoader() {
  return (
    <div className="mx-auto max-w-6xl animate-in fade-in duration-200 space-y-6">
      {/* Back link skeleton */}
      <div className="h-4 w-40 bg-input animate-pulse" />

      {/* Score header skeleton */}
      <div className="bg-card border border-rule">
        <div className="border-b border-rule px-6 py-2.5">
          <div className="h-3 w-32 bg-input animate-pulse" />
        </div>
        <div className="p-10">
          <div className="flex items-center justify-center gap-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-20 w-20 bg-input animate-pulse" />
              <div className="h-4 w-24 bg-input animate-pulse" />
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-4">
                <div className="h-14 w-16 bg-input animate-pulse" />
                <div className="h-6 w-4 bg-input animate-pulse" />
                <div className="h-14 w-16 bg-input animate-pulse" />
              </div>
              <div className="h-3 w-20 bg-input animate-pulse" />
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="h-20 w-20 bg-input animate-pulse" />
              <div className="h-4 w-24 bg-input animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Box score skeleton */}
      <div className="flex gap-px border border-rule w-fit">
        <div className="h-10 w-32 bg-input animate-pulse" />
        <div className="h-10 w-32 bg-input animate-pulse" />
      </div>
      <div className="bg-card border border-rule p-4 space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-7 w-7 bg-input animate-pulse" />
            <div className="h-4 bg-input animate-pulse" style={{ width: `${120 + (i % 3) * 30}px` }} />
            <div className="ml-auto flex gap-4">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="h-4 w-8 bg-input animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
