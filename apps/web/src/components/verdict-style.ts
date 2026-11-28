import type { Verdict } from "@scamshield/shared";
import {
  ExclamationCircleIcon,
  InfoCircleIcon,
  QuestionCircleIcon,
  WarningTriangleIcon,
} from "./Icon";

/** Icon and colours of a verdict, shared by the banner and the badge (design-system §2, §4). */
export const VERDICT_STYLES = {
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
