import type { CheckStatus as Status } from "@scamshield/shared";
import { CheckStatus } from "./CheckStatus";

type Item = { name: string; status: Status; detail: string | null };

/** P5: the value came from the message. It is text, never a link, and wraps anywhere. */
export function IndicatorCard({ value, checks }: { value: string; checks: Item[] }) {
  return (
    <div className="rounded-card border border-border p-3">
      <p className="font-mono wrap-anywhere">{value}</p>
      {checks.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {checks.map((check, index) => (
            <li key={index} className="text-sm">
              <p>{check.name}</p>
              <CheckStatus status={check.status} />
              {check.detail ? (
                <p className="wrap-anywhere text-text-muted">{check.detail}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
