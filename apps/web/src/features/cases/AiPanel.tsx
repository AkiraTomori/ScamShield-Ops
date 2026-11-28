import { useId } from "react";
import type { CaseDetail } from "@scamshield/shared";
import { SignalList } from "../../components/SignalList";
import { SourceBadge } from "../../components/SourceBadge";
import { vi } from "../../copy/vi";
import type { ResultViewModel } from "../analysis/view-model";
import { Block } from "./EvidencePanel";

/** What the model wrote, marked as such. Next steps are text: there is nothing to press (P1). */
export function AiPanel({ detail, view }: { detail: CaseDetail; view: ResultViewModel }) {
  const t = vi.ops.detail;
  const id = useId();
  const signals = view.signals.filter((signal) => signal.source === "ai");

  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-4 rounded-card bg-source-ai-bg p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-bold">
          {t.aiHeading}
        </h2>
        <SourceBadge source="ai" />
      </div>

      {detail.aiSummary ? (
        <>
          <Block heading={t.summaryHeading}>
            <p className="wrap-anywhere">{detail.aiSummary.summary}</p>
          </Block>
          <Block heading={t.nextStepsHeading}>
            <ul className="flex list-disc flex-col gap-1 pl-6">
              {detail.aiSummary.nextSteps.map((step, index) => (
                <li key={index} className="wrap-anywhere">
                  {step}
                </li>
              ))}
            </ul>
          </Block>
        </>
      ) : (
        <p>{t.noSummary}</p>
      )}

      <Block heading={t.aiSignalsHeading}>
        {signals.length > 0 ? <SignalList signals={signals} /> : <p>{vi.result.noSignals}</p>}
      </Block>

      {view.explanation ? (
        <Block heading={t.explanationHeading}>
          <p className="wrap-anywhere">{view.explanation}</p>
        </Block>
      ) : null}
    </section>
  );
}
