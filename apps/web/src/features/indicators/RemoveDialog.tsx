"use client";

import { useEffect, useId, useLayoutEffect, useRef, type FormEvent } from "react";
import { countInputChars } from "@scamshield/shared/input";
import { DECISION_REASON_MAX_CHARS } from "@scamshield/shared/ops";
import { Button } from "../../components/Button";
import { CharCounter } from "../../components/CharCounter";
import { ErrorState } from "../../components/ErrorState";
import { TextArea } from "../../components/TextArea";
import { vi } from "../../copy/vi";

export interface RemoveDialogProps {
  indicator: string;
  reason: string;
  sending: boolean;
  /** A new object on every refused attempt, so focus returns to the field each time. */
  reasonError?: { message: string };
  /** An error about the whole request. */
  error?: string;
  onReason: (reason: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * Asks why an indicator comes off the list (SO-08-AC03, verified-indicators §6). The native modal
 * dialog traps focus and handles Esc. It stays open while the request fails, so the reason survives;
 * `ConfirmDialog` closes before it calls back, so it cannot do that.
 */
export function RemoveDialog({
  indicator,
  reason,
  sending,
  reasonError,
  error,
  onReason,
  onSubmit,
  onCancel,
}: RemoveDialogProps) {
  const t = vi.ops.indicators;
  const ref = useRef<HTMLDialogElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  // A layout effect, so the cleanup closes the dialog while it is still in the document: only then
  // does the browser give focus back to the button that opened it.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    reasonRef.current?.focus();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    if (reasonError) reasonRef.current?.focus();
  }, [reasonError]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Esc. Ignored while sending: the answer decides what happens to the dialog.
      onCancel={(event) => {
        event.preventDefault();
        if (!sending) onCancel();
      }}
      // A browser may close it anyway after a second Esc.
      onClose={() => {
        if (!ref.current?.open) onCancel();
      }}
      className="m-auto w-full max-w-md rounded-card border border-border-strong bg-bg p-4 text-text backdrop:bg-text/50"
    >
      <form
        noValidate
        // Never GET: a submit before hydration must not put the reason on the URL.
        method="post"
        className="flex flex-col gap-3"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (!sending) onSubmit();
        }}
      >
        <h2 id={titleId} className="font-semibold wrap-anywhere">
          {t.dialogTitle(indicator)}
        </h2>
        <TextArea
          ref={reasonRef}
          id="removal-reason"
          label={vi.ops.decision.reasonLabel}
          counterId="removal-reason-count"
          error={reasonError?.message}
          rows={4}
          required
          readOnly={sending}
          value={reason}
          onChange={(event) => onReason(event.target.value)}
        />
        <div className="self-end">
          <CharCounter
            id="removal-reason-count"
            count={countInputChars(reason)}
            max={DECISION_REASON_MAX_CHARS}
          />
        </div>
        {error ? <ErrorState message={error} /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={sending} onClick={onCancel}>
            {t.cancel}
          </Button>
          <Button type="submit" loading={sending} loadingLabel={t.submitting}>
            {t.confirm}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
