import type { CheckStatus as Status } from "@scamshield/shared";
import { vi } from "../copy/vi";
import { ExclamationCircleIcon, MinusCircleIcon, QuestionCircleIcon } from "./Icon";

// `pass` is deliberately neutral: it is one check finding nothing, never a verdict.
const STATUSES = {
  warn: { Icon: ExclamationCircleIcon, className: "text-verdict-suspicious" },
  pass: { Icon: MinusCircleIcon, className: "text-text-muted" },
  unavailable: { Icon: QuestionCircleIcon, className: "text-verdict-inconclusive" },
} satisfies Record<Status, unknown>;

export function CheckStatus({ status }: { status: Status }) {
  const { Icon, className } = STATUSES[status];
  return (
    <div className="text-sm">
      <span className={`inline-flex items-center gap-1 font-semibold ${className}`}>
        <Icon />
        {vi.checkStatus[status]}
      </span>
      {status === "unavailable" ? (
        <p className="text-text-muted">{vi.checkUnavailableNote}</p>
      ) : null}
    </div>
  );
}
