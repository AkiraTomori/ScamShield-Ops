"use client";

import { Decision } from "@scamshield/shared/enums";
import { countInputChars } from "@scamshield/shared/input";
import { DECISION_REASON_MAX_CHARS } from "@scamshield/shared/ops";
import { Button } from "../../components/Button";
import { CharCounter } from "../../components/CharCounter";
import { ErrorState } from "../../components/ErrorState";
import { TextArea } from "../../components/TextArea";
import { vi } from "../../copy/vi";

export interface DecisionFormProps {
  choice: Decision | null;
  reason: string;
  sending: boolean;
  choiceError?: string;
  reasonError?: string;
  /** An error about the whole request. */
  error?: string;
  onChoice: (choice: Decision) => void;
  onReason: (reason: string) => void;
  onSubmit: () => void;
}

/** The conclusion form of ui-pages §6.2. State lives in `DecisionSection`. */
export function DecisionForm({
  choice,
  reason,
  sending,
  choiceError,
  reasonError,
  error,
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
        {Decision.options.map((option) => (
          <label key={option} className="flex min-h-11 items-center gap-2">
            <input
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
      </fieldset>

      <TextArea
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
