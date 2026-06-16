export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-card border border-border-t p-8">
        {/* Title */}
        <div className="space-y-2 text-center">
          <div className="mx-auto h-7 w-40 animate-pulse rounded-lg bg-input" />
          <div className="mx-auto h-4 w-56 animate-pulse rounded bg-input" />
        </div>
        {/* Fields */}
        <div className="space-y-4">
          <div className="h-11 w-full animate-pulse rounded-xl bg-input" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-input" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-input" />
        </div>
      </div>
    </div>
  );
}
