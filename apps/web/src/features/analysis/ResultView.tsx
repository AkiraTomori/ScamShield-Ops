import { useId, type ReactNode } from "react";
import type { AnalysisResult } from "@scamshield/shared/analysis";
import { Button } from "../../components/Button";
import { Disclaimer } from "../../components/Disclaimer";
import { IndicatorCard } from "../../components/IndicatorCard";
import { RedactionNotice } from "../../components/RedactionNotice";
import { SignalList } from "../../components/SignalList";
import { SourceBadge } from "../../components/SourceBadge";
import { VerdictBanner } from "../../components/VerdictBanner";
import { vi } from "../../copy/vi";
import { toViewModel } from "./view-model";

function Section({
  heading,
  className = "",
  aside,
  children,
}: {
  heading: string;
  className?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="text-lg font-bold">
          {heading}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The result block, in the order of ui-pages §2.3. What to show is decided by `toViewModel`. */
export function ResultView({
  result,
  actions,
  onRetry,
}: {
  result: AnalysisResult;
  actions: ReactNode;
  onRetry: () => void;
}) {
  const view = toViewModel(result);

  return (
    <div className="flex flex-col gap-5">
      <VerdictBanner verdict={view.verdict}>
        {view.note ? <p className="mt-2 font-semibold">{view.note}</p> : null}
        {view.canRetry ? (
          <div className="mt-3">
            <Button variant="secondary" onClick={onRetry}>
              {vi.retry}
            </Button>
          </div>
        ) : null}
      </VerdictBanner>

      {view.redactionNotice ? <RedactionNotice text={view.redactionNotice} /> : null}

      {view.explanation ? (
        // AI text always has its badge and its own background (design-system §1).
        <Section
          heading={vi.result.explanationHeading}
          aside={<SourceBadge source="ai" />}
          className="rounded-card bg-source-ai-bg p-4"
        >
          <p className="wrap-anywhere">{view.explanation}</p>
        </Section>
      ) : null}

      {view.signals.length > 0 ? (
        <Section heading={vi.result.signalsHeading}>
          <SignalList signals={view.signals} />
        </Section>
      ) : null}

      {view.indicators.length > 0 ? (
        <Section heading={vi.result.indicatorsHeading}>
          {view.indicators.map((indicator, index) => (
            <IndicatorCard key={index} {...indicator} />
          ))}
        </Section>
      ) : null}

      {/* Fixed advice chosen by code, so no AI badge (SO-05-AC03). */}
      <Section heading={vi.result.recommendationsHeading}>
        <ol className="flex list-decimal flex-col gap-1 pl-6">
          {view.recommendations.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ol>
      </Section>

      {actions}
      <Disclaimer />
    </div>
  );
}
