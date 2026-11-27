import type { PublicCaseStatus } from "@scamshield/shared";
import { vi } from "../copy/vi";

/** The state of a case in words (design-system §4). No colour carries meaning on its own. */
export function StatusBadge({ status }: { status: PublicCaseStatus }) {
  return (
    <p className="self-start rounded-control border border-border-strong bg-surface-subtle px-3 py-2 font-bold">
      {vi.publicStatus[status].label}
    </p>
  );
}
