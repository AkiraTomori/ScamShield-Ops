import { useId, type ReactNode } from "react";
import type { CaseDetail } from "@scamshield/shared";
import { IndicatorCard } from "../../components/IndicatorCard";
import { SignalList } from "../../components/SignalList";
import { VerdictBadge } from "../../components/VerdictBadge";
import { vi } from "../../copy/vi";
import type { ResultViewModel } from "../analysis/view-model";

export function Block({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-bold">{heading}</h3>
      {children}
    </div>
  );
}

/**
 * The data and the deterministic checks (SO-05-AC03). Everything from the message or the reporter is
 * text: no link, no markup (P5).
 */
export function EvidencePanel({ detail, view }: { detail: CaseDetail; view: ResultViewModel }) {
  const t = vi.ops.detail;
  const id = useId();
  const { analysis } = detail;
  const signals = view.signals.filter((signal) => signal.source === "deterministic");
  const risks = analysis.riskTypes.map((risk) => vi.ops.list.riskType[risk]).join(", ");

  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-4 rounded-card border border-border p-4"
    >
      <h2 id={id} className="text-lg font-bold">
        {t.evidenceHeading}
      </h2>

      <Block heading={t.contentHeading}>
        <p className="rounded-control bg-surface-subtle p-3 font-mono wrap-anywhere whitespace-pre-wrap">
          {detail.redactedContent}
        </p>
        {view.redactionNotice ? <p className="text-sm">{view.redactionNotice}</p> : null}
      </Block>

      <Block heading={t.noteHeading}>
        {detail.reporterNote ? (
          <p className="wrap-anywhere whitespace-pre-wrap">{detail.reporterNote}</p>
        ) : (
          <p className="text-text-muted">{t.noNote}</p>
        )}
      </Block>

      <Block heading={t.engineHeading}>
        <div>
          <VerdictBadge verdict={analysis.verdict} />
        </div>
        {/* Only the hard-evidence note: the other notes tell the sender to try again. */}
        {analysis.verdict === "high_risk" && analysis.inconclusiveReason ? (
          <p>{vi.result.llmSkippedNote}</p>
        ) : null}
        <p>
          {t.risks}: {risks || "—"}
        </p>
        <p>
          {t.rule}: {t.rules[analysis.rule]}
        </p>
      </Block>

      <Block heading={t.indicatorsHeading}>
        {view.indicators.length > 0 ? (
          view.indicators.map((indicator, index) => <IndicatorCard key={index} {...indicator} />)
        ) : (
          <p className="text-text-muted">{vi.result.noIndicators}</p>
        )}
      </Block>

      <Block heading={t.checkSignalsHeading}>
        {signals.length > 0 ? (
          <SignalList signals={signals} />
        ) : (
          <p className="text-text-muted">{vi.result.noSignals}</p>
        )}
      </Block>
    </section>
  );
}
