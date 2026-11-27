import type { ReactNode } from "react";
import type { Verdict } from "@scamshield/shared";
import { vi } from "../copy/vi";
import {
  ExclamationCircleIcon,
  InfoCircleIcon,
  QuestionCircleIcon,
  WarningTriangleIcon,
} from "./Icon";

const VERDICTS = {
  high_risk: {
    Icon: WarningTriangleIcon,
    className: "bg-verdict-high-risk-bg text-verdict-high-risk",
  },
  suspicious: {
    Icon: ExclamationCircleIcon,
    className: "bg-verdict-suspicious-bg text-verdict-suspicious",
  },
  no_signal: {
    Icon: InfoCircleIcon,
    className: "bg-verdict-no-signal-bg text-verdict-no-signal",
  },
  inconclusive: {
    Icon: QuestionCircleIcon,
    className: "bg-verdict-inconclusive-bg text-verdict-inconclusive",
  },
} satisfies Record<Verdict, unknown>;

/**
 * Verdict, icon and meaning. The `aria-live` region belongs to the caller, because it has to exist
 * before the result arrives. `children` holds extra notes under the meaning.
 */
export function VerdictBanner({ verdict, children }: { verdict: Verdict; children?: ReactNode }) {
  const { Icon, className } = VERDICTS[verdict];
  return (
    <div className={`rounded-card p-4 ${className}`}>
      <div className="flex items-center gap-2 text-xl">
        <Icon />
        <h2 className="font-bold">{vi.verdict[verdict].label}</h2>
      </div>
      <p className="mt-2">{vi.verdict[verdict].explanation}</p>
      {children}
    </div>
  );
}
