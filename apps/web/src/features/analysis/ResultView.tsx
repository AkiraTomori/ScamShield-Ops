import type { ReactNode } from "react";
import type { AnalysisResult } from "@scamshield/shared";
import { Disclaimer } from "../../components/Disclaimer";
import { VerdictBanner } from "../../components/VerdictBanner";

/**
 * Result block. So far only the verdict: explanation, signals, indicators and recommendations
 * come with T-042.
 */
export function ResultView({ result, actions }: { result: AnalysisResult; actions: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <VerdictBanner verdict={result.verdict} />
      {actions}
      <Disclaimer />
    </div>
  );
}
