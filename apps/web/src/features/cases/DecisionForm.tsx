"use client";

import type { Ref } from "react";
import { Decision, type MatchableIndicatorType } from "@scamshield/shared/enums";
import { countInputChars } from "@scamshield/shared/input";
import { DECISION_REASON_MAX_CHARS } from "@scamshield/shared/ops";
import { Button } from "../../components/Button";
import { CharCounter } from "../../components/CharCounter";
import { ErrorState } from "../../components/ErrorState";
import { TextArea } from "../../components/TextArea";
import { vi } from "../../copy/vi";

/** What confirming the case as a scam adds to the confirmed list; computed on the server. */
export type IndicatorsToConfirm = readonly { type: MatchableIndicatorType; normalized: string }[];

export interface DecisionFormProps {
  toConfirm: IndicatorsToConfirm;
  choice: Decision | null;
  reason: string;
  sending: boolean;
  choiceError?: string;
  reasonError?: string;
  /** An error about the whole request. */
  error?: string;
  firstChoiceRef?: Ref<HTMLInputElement>;
  reasonRef?: Ref<HTMLTextAreaElement>;
  onChoice: (choice: Decision) => void;
  onReason: (reason: string) => void;
  onSubmit: () => void;
}

/** SO-08-AC01: staff see what will be recorded before saving. Text only, never links (P5). */
function ToConfirm({ items }: { items: IndicatorsToConfirm }) {
  const t = vi.ops.decision;
  if (items.length === 0) return <p className="text-sm">{t.toConfirmNone}</p>;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="font-semibold">{t.toConfirm}</p>
      <ul className="flex flex-col gap-1">
        {items.map(({ type, normalized }) => (
          <li key={`${type}:${normalized}`} className="wrap-anywhere">
            {vi.ops.detail.indicatorType[type]}: <span className="font-mono">{normalized}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The conclusion form of ui-pages §6.2. State lives in `DecisionSection`. */
export function DecisionForm({
  toConfirm,
  choice,
  reason,
  sending,
  choiceError,
  reasonError,
  error,
  firstChoiceRef,
  reasonRef,
  onChoice,
  onReason,
  onSubmit,
}: DecisionFormProps) {
  const t = vi.ops.decision;
  return (
    <form
      noValidate
      // Never GET: a submit before hydration must not put the reason on the URL.
      method="post"
      aria-label={t.heading}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!sending) onSubmit();
      }}
    >
      <fieldset
        aria-describedby={choiceError ? "decision-choice-error" : undefined}
        className="flex flex-col gap-1"
      >
        <legend className="font-semibold">{t.choiceLegend} *</legend>
        {Decision.options.map((option, index) => (
          <label key={option} className="flex min-h-11 items-center gap-2">
            <input
              ref={index === 0 ? firstChoiceRef : undefined}
              // On the radio too: not every screen reader reads a fieldset's description.
              aria-describedby={choiceError ? "decision-choice-error" : undefined}
              type="radio"
              name="decision"
              value={option}
              required
              checked={choice === option}
              onChange={() => {
                if (!sending) onChoice(option);
              }}
            />
            {vi.ops.list.decision[option]}
          </label>
        ))}
        {choiceError ? (
          <p id="decision-choice-error" className="text-sm text-danger">
            {choiceError}
          </p>
        ) : null}
        {/* Always mounted: a live region that appears already filled is often not read. */}
        <div aria-live="polite">
          {choice === "confirmed_scam" ? <ToConfirm items={toConfirm} /> : null}
        </div>
      </fieldset>

      <TextArea
        ref={reasonRef}
        id="decision-reason"
        label={t.reasonLabel}
        counterId="decision-reason-count"
        error={reasonError}
        rows={4}
        required
        readOnly={sending}
        value={reason}
        onChange={(event) => onReason(event.target.value)}
      />
      <div className="self-end">
        <CharCounter
          id="decision-reason-count"
          count={countInputChars(reason)}
          max={DECISION_REASON_MAX_CHARS}
        />
      </div>

      {error ? <ErrorState message={error} /> : null}

      {/* Always pressable: pressing it early says what is missing (fraudops §5.4). */}
      <div className="self-start">
        <Button type="submit" loading={sending} loadingLabel={t.submitting}>
          {t.submit}
        </Button>
      </div>
    </form>
  );
}
