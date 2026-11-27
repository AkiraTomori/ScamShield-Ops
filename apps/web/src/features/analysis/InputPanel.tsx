import type { Ref } from "react";
import { DEMO_MESSAGES } from "@scamshield/shared/demo-messages";
import { countInputChars, MAX_INPUT_CHARS } from "@scamshield/shared/input";
import { Button } from "../../components/Button";
import { CharCounter } from "../../components/CharCounter";
import { SampleChips } from "../../components/SampleChips";
import { TextArea } from "../../components/TextArea";
import { vi } from "../../copy/vi";

const SAMPLES = DEMO_MESSAGES.flatMap(({ id, chip, content }) =>
  chip === null ? [] : [{ id, label: chip, content }],
);

export function InputPanel({
  content,
  fieldError,
  busy,
  locked,
  textareaRef,
  submitRef,
  onChange,
  onSubmit,
}: {
  content: string;
  fieldError?: string;
  /** A request is on its way: the text is read-only and samples are locked. */
  busy: boolean;
  /** A report of this text is being sent, or its codes are on screen (report-flow §5.2). */
  locked?: "sending" | "reported";
  textareaRef?: Ref<HTMLTextAreaElement>;
  submitRef?: Ref<HTMLButtonElement>;
  onChange: (content: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <TextArea
        ref={textareaRef}
        id="message"
        label={vi.analysis.inputLabel}
        counterId="message-count"
        error={fieldError}
        readOnly={busy || locked !== undefined}
        value={content}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="self-end">
        <CharCounter id="message-count" count={countInputChars(content)} max={MAX_INPUT_CHARS} />
      </div>
      <p className="text-sm text-text-muted">{vi.analysis.privacyHint}</p>
      <SampleChips
        heading={vi.analysis.samplesLabel}
        samples={SAMPLES}
        disabled={busy || locked !== undefined}
        onPick={onChange}
      />
      {locked === "reported" ? <p className="font-semibold">{vi.report.locked}</p> : null}
      <div className="flex flex-col">
        <Button
          ref={submitRef}
          type="submit"
          loading={busy}
          loadingLabel={vi.analysis.submitting}
          disabled={locked !== undefined}
        >
          {vi.analysis.submit}
        </Button>
      </div>
    </form>
  );
}
