export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="relative w-full max-w-md overflow-hidden border border-rule bg-card p-6 sm:p-8">
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
        {/* Title */}
        <div className="space-y-2">
          <div className="h-8 w-40 animate-pulse bg-input" />
          <div className="h-3 w-56 animate-pulse bg-input/30" />
        </div>
        {/* Fields */}
        <div className="mt-8 space-y-5">
          <div className="h-12 w-full animate-pulse bg-input" />
          <div className="h-12 w-full animate-pulse bg-input" />
          <div className="h-12 w-full animate-pulse bg-input" />
        </div>
      </div>
    </div>
  );
}
