import type { DecisionRecord } from "@scamshield/shared";
import { ExclamationCircleIcon } from "../../components/Icon";
import { vi } from "../../copy/vi";
import { formatUpdatedAt } from "../lookup/format-time";

/** A stored conclusion, read only. The reason is a person's text and is shown as text. */
export function DecisionCard({ decision }: { decision: DecisionRecord }) {
  const t = vi.ops.decision;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap gap-x-3">
        <span className="font-bold">{vi.ops.list.decision[decision.decision]}</span>
        <span>{decision.decidedBy}</span>
        <time dateTime={decision.decidedAt}>{formatUpdatedAt(decision.decidedAt)}</time>
      </p>
      <p className="wrap-anywhere whitespace-pre-wrap">
        {t.reason}: {decision.reason}
      </p>
      {decision.disagreesWithEngine ? (
        <p className="flex items-center gap-2 font-semibold text-verdict-suspicious">
          <ExclamationCircleIcon />
          {t.disagrees}
        </p>
      ) : null}
    </div>
  );
}
