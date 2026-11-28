import { vi } from "../copy/vi";

/** Marks a seeded demo case (SO-10-AC03). */
export function SeedBadge() {
  return (
    <span className="inline-block rounded-control border border-border-strong bg-surface-subtle px-2 py-0.5 text-xs font-semibold">
      {vi.ops.list.seed}
    </span>
  );
}
