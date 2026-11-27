import type { SignalSource } from "@scamshield/shared";
import { vi } from "../copy/vi";
import { SearchIcon, SparkIcon } from "./Icon";

const SOURCES = {
  deterministic: { Icon: SearchIcon, className: "bg-source-check-bg text-source-check" },
  ai: { Icon: SparkIcon, className: "bg-source-ai-bg text-source-ai" },
} satisfies Record<SignalSource, unknown>;

export function SourceBadge({ source }: { source: SignalSource }) {
  const { Icon, className } = SOURCES[source];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      <Icon />
      {vi.signalSource[source]}
    </span>
  );
}
