import type { ReactNode } from "react";

/** Frame of the hand-drawn icons (design-system §4). Decorative: text always says the same thing. */
export function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="1.25em"
      height="1.25em"
      className="shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function WarningTriangleIcon() {
  return (
    <Icon>
      <path d="M12 3 22 21H2L12 3Z" fill="currentColor" />
      <path d="M12 10v5M12 18h.01" className="stroke-bg" />
    </Icon>
  );
}

export function ExclamationCircleIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5h.01" />
    </Icon>
  );
}

export function InfoCircleIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5h.01" />
    </Icon>
  );
}

export function QuestionCircleIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7M12 17h.01" />
    </Icon>
  );
}

export function MinusCircleIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </Icon>
  );
}

export function SearchIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </Icon>
  );
}

export function SparkIcon() {
  return (
    <Icon>
      <path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z" />
    </Icon>
  );
}
