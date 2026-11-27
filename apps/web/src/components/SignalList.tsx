import type { SignalSource } from "@scamshield/shared";
import { SourceBadge } from "./SourceBadge";

type Item = { label: string; source: SignalSource; evidence: string | null };

/** One row per signal, in the order given. Quoted text is shown as text only. */
export function SignalList({ signals }: { signals: Item[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {signals.map((signal, index) => (
        <li key={index} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{signal.label}</span>
            <SourceBadge source={signal.source} />
          </div>
          {signal.evidence ? (
            <p className="text-sm wrap-anywhere text-text-muted">“{signal.evidence}”</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
