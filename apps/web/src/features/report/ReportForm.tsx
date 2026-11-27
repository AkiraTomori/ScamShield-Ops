import type { Ref } from "react";
import { ReportChannel } from "@scamshield/shared/enums";
import { countInputChars } from "@scamshield/shared/input";
import { REPORT_NOTE_MAX_CHARS } from "@scamshield/shared/report";
import { Button } from "../../components/Button";
import { CharCounter } from "../../components/CharCounter";
import { ErrorState } from "../../components/ErrorState";
import { TextArea } from "../../components/TextArea";
import { vi } from "../../copy/vi";

export interface ReportFormProps {
  channel: ReportChannel | null;
  note: string;
  sending: boolean;
  /** The analysis no longer exists: sending again cannot work. */
  gone?: boolean;
  channelError?: string;
  noteError?: string;
  /** An error about the whole request. */
  error?: string;
  firstChannelRef?: Ref<HTMLInputElement>;
  onChannel: (channel: ReportChannel) => void;
  onNote: (note: string) => void;
  onSubmit: () => void;
}

/** The report form of ui-pages §2.4. State lives in `ReportPanel`. */
export function ReportForm({
  channel,
  note,
  sending,
  gone = false,
  channelError,
  noteError,
  error,
  firstChannelRef,
  onChannel,
  onNote,
  onSubmit,
}: ReportFormProps) {
  return (
    <form
      noValidate
      // Never GET: a submit before hydration must not put anything on the URL.
      method="post"
      aria-label={vi.report.open}
      className="flex flex-col gap-3 rounded-card border border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!sending && !gone) onSubmit();
      }}
    >
      <fieldset
        aria-describedby={channelError ? "report-channel-error" : undefined}
        className="flex flex-col gap-1"
      >
        <legend className="font-semibold">{vi.report.channelLegend} *</legend>
        <div className="flex flex-wrap gap-x-4">
          {ReportChannel.options.map((option, index) => (
            <label key={option} className="flex min-h-11 items-center gap-2">
              <input
                ref={index === 0 ? firstChannelRef : undefined}
                type="radio"
                name="channel"
                value={option}
                required
                checked={channel === option}
                onChange={() => {
                  if (!sending) onChannel(option);
                }}
              />
              {vi.report.channel[option]}
            </label>
          ))}
        </div>
        {channelError ? (
          <p id="report-channel-error" className="text-sm text-danger">
            {channelError}
          </p>
        ) : null}
      </fieldset>

      <TextArea
        id="report-note"
        label={vi.report.noteLabel}
        counterId="report-note-count"
        error={noteError}
        rows={3}
        readOnly={sending}
        value={note}
        onChange={(event) => onNote(event.target.value)}
      />
      <div className="self-end">
        <CharCounter
          id="report-note-count"
          count={countInputChars(note)}
          max={REPORT_NOTE_MAX_CHARS}
        />
      </div>

      {error ? <ErrorState message={error} /> : null}

      <Button type="submit" loading={sending} loadingLabel={vi.report.submitting} disabled={gone}>
        {vi.report.submit}
      </Button>
    </form>
  );
}
