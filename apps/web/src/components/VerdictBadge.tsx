import type { Verdict } from "@scamshield/shared";
import { vi } from "../copy/vi";
import { VERDICT_STYLES } from "./verdict-style";

/** A verdict in one line, for tables: icon and words, never colour alone. */
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const { Icon, className } = VERDICT_STYLES[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-control px-2 py-0.5 font-semibold ${className}`}
    >
      <Icon />
      {vi.verdict[verdict].label}
    </span>
  );
}
