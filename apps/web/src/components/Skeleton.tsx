/** Placeholder lines. Decorative: the caller announces the waiting state in text. */
export function Skeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex animate-pulse flex-col gap-2 motion-reduce:animate-none"
    >
      <div className="h-8 w-2/3 rounded-control bg-surface-subtle" />
      <div className="h-4 w-full rounded-control bg-surface-subtle" />
      <div className="h-4 w-5/6 rounded-control bg-surface-subtle" />
    </div>
  );
}
