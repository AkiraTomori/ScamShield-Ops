import type { ReactNode } from "react";
import type { Verdict } from "@scamshield/shared";
import { vi } from "../copy/vi";
import { VERDICT_STYLES } from "./verdict-style";

/**
 * Verdict, icon and meaning. The `aria-live` region belongs to the caller, because it has to exist
 * before the result arrives. `children` holds extra notes under the meaning.
 */
export function VerdictBanner({ verdict, children }: { verdict: Verdict; children?: ReactNode }) {
  const { Icon, className } = VERDICT_STYLES[verdict];
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
