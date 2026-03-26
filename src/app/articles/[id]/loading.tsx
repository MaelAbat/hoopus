export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-pulse">
      <div className="h-8 w-40 rounded-xl bg-input" />
      <div className="aspect-[21/9] w-full rounded-2xl bg-input" />
      <div className="flex gap-4">
        <div className="h-5 w-28 rounded bg-input" />
        <div className="h-5 w-36 rounded bg-input" />
        <div className="h-5 w-20 rounded bg-input" />
      </div>
      <div className="h-16 rounded-xl bg-input" />
      <div className="rounded-2xl bg-card border border-border-t p-8 space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-4 rounded bg-input" style={{ width: `${90 - i * 5}%` }} />
        ))}
      </div>
    </div>
  );
}
