"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ReportChannel } from "@scamshield/shared";
import { ERROR_MESSAGE_VI } from "@scamshield/shared/errors";
import { REPORT_ERROR_MESSAGE_VI, ReportRequest } from "@scamshield/shared/report";
import { Button } from "../../components/Button";
import { vi } from "../../copy/vi";
import { ReportForm } from "./ReportForm";
import { ReportAlreadySent, ReportSent } from "./ReportReceipt";
import { submitReport, type ReportOutcome } from "./submit-report";

type Errors = { channelError?: string; noteError?: string; error?: string; gone?: boolean };
type Phase =
  | { step: "closed" }
  | ({ step: "form"; sending: boolean } & Errors)
  | { step: "sent"; caseCode: string; secretCode: string }
  | { step: "already"; caseCode: string };

function afterFailure(outcome: ReportOutcome): Errors {
  switch (outcome.kind) {
    case "not_found":
      return { error: vi.report.analysisGone, gone: true };
    case "rate_limited":
      return { error: ERROR_MESSAGE_VI.rate_limited };
    case "invalid":
      return { error: outcome.message };
    default:
      return { error: vi.report.failed };
  }
}

/**
 * The actions under a result: report it (ui-pages §2.4) or check another message. Mount with a key
 * per analysis, so the form never carries over to another result.
 */
export function ReportPanel({
  analysisId,
  another,
  onSending,
  onSettled,
}: {
  analysisId: string;
  another: ReactNode;
  onSending: () => void;
  onSettled: (secretShown: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ step: "closed" });
  const [channel, setChannel] = useState<ReportChannel | null>(null);
  const [note, setNote] = useState("");
  const firstChannelRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLHeadingElement>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  // The button that had focus is gone in both cases.
  const { step } = phase;
  useEffect(() => {
    if (step === "form") firstChannelRef.current?.focus();
    if (step === "sent" || step === "already") receiptRef.current?.focus();
  }, [step]);

  /** A field's error goes once the user changes that field. */
  const clear = (error: "channelError" | "noteError") =>
    setPhase((now) => (now.step === "form" ? { ...now, [error]: undefined } : now));

  async function send() {
    const body = ReportRequest.safeParse({ channel, ...(note === "" ? {} : { note }) });
    if (!body.success) {
      const invalid = new Set(body.error.issues.map((issue) => issue.path[0]));
      setPhase({
        step: "form",
        sending: false,
        channelError: invalid.has("channel") ? REPORT_ERROR_MESSAGE_VI.channel : undefined,
        noteError: invalid.has("note") ? REPORT_ERROR_MESSAGE_VI.note : undefined,
      });
      return;
    }
    setPhase({ step: "form", sending: true });
    onSending();
    request.current = new AbortController();
    const outcome = await submitReport(analysisId, body.data, { signal: request.current.signal });
    if (outcome.kind === "aborted") return;

    onSettled(outcome.kind === "created");
    if (outcome.kind === "created") {
      setPhase({ step: "sent", caseCode: outcome.caseCode, secretCode: outcome.secretCode });
    } else if (outcome.kind === "already_reported") {
      setPhase({ step: "already", caseCode: outcome.caseCode });
    } else {
      setPhase({ step: "form", sending: false, ...afterFailure(outcome) });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {phase.step === "closed" ? (
        <Button onClick={() => setPhase({ step: "form", sending: false })}>{vi.report.open}</Button>
      ) : null}
      {phase.step === "form" ? (
        <ReportForm
          channel={channel}
          note={note}
          sending={phase.sending}
          gone={phase.gone}
          channelError={phase.channelError}
          noteError={phase.noteError}
          error={phase.error}
          firstChannelRef={firstChannelRef}
          onChannel={(next) => {
            setChannel(next);
            clear("channelError");
          }}
          onNote={(next) => {
            setNote(next);
            clear("noteError");
          }}
          onSubmit={send}
        />
      ) : null}
      {phase.step === "sent" ? (
        <ReportSent
          caseCode={phase.caseCode}
          secretCode={phase.secretCode}
          headingRef={receiptRef}
        />
      ) : null}
      {phase.step === "already" ? (
        <ReportAlreadySent caseCode={phase.caseCode} headingRef={receiptRef} />
      ) : null}
      {another}
    </div>
  );
}
