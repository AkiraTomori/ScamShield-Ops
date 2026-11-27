"use client";

import { useEffect, useRef, useState } from "react";
import { ERROR_MESSAGE_VI } from "@scamshield/shared/errors";
import {
  CASE_LOOKUP_MAX_CHARS,
  CASE_NOT_FOUND_MESSAGE_VI,
  CaseStatusRequest,
  type CaseStatusResponse,
} from "@scamshield/shared/report";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { TextInput } from "../../components/TextInput";
import { vi } from "../../copy/vi";
import { StatusResult } from "./StatusResult";
import { submitStatus } from "./submit-status";

type View =
  | { step: "idle" }
  | { step: "sending" }
  | { step: "found"; result: CaseStatusResponse }
  | { step: "error"; message: string };

export function CaseStatusFeature() {
  const [caseCode, setCaseCode] = useState("");
  const [secretCode, setSecretCode] = useState("");
  const [view, setView] = useState<View>({ step: "idle" });
  const request = useRef<AbortController | null>(null);
  const sending = view.step === "sending";

  useEffect(() => () => request.current?.abort(), []);

  async function lookUp() {
    const body = CaseStatusRequest.safeParse({ caseCode, secretCode });
    if (!body.success) {
      setView({ step: "error", message: vi.caseStatus.missing });
      return;
    }
    setView({ step: "sending" });
    request.current = new AbortController();
    const outcome = await submitStatus(body.data, { signal: request.current.signal });
    if (outcome.kind === "aborted") return;
    if (outcome.kind === "found") {
      setView({ step: "found", result: outcome.result });
      return;
    }
    setView({
      step: "error",
      message:
        outcome.kind === "not_found"
          ? CASE_NOT_FOUND_MESSAGE_VI
          : outcome.kind === "rate_limited"
            ? ERROR_MESSAGE_VI.rate_limited
            : vi.caseStatus.failed,
    });
  }

  // An answer belongs to the codes it was asked with.
  const edit = (set: (value: string) => void) => (value: string) => {
    if (sending) return;
    set(value);
    setView({ step: "idle" });
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        noValidate
        // Never GET: a submit before hydration must not put a code on the URL.
        method="post"
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!sending) void lookUp();
        }}
      >
        <TextInput
          id="case-code"
          label={vi.caseStatus.codeLabel}
          placeholder={vi.caseStatus.codePlaceholder}
          maxLength={CASE_LOOKUP_MAX_CHARS}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          readOnly={sending}
          value={caseCode}
          onChange={(event) => edit(setCaseCode)(event.target.value)}
        />
        <TextInput
          id="secret-code"
          label={vi.caseStatus.secretLabel}
          maxLength={CASE_LOOKUP_MAX_CHARS}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          readOnly={sending}
          value={secretCode}
          onChange={(event) => edit(setSecretCode)(event.target.value)}
        />
        <Button type="submit" loading={sending} loadingLabel={vi.caseStatus.submitting}>
          {vi.caseStatus.submit}
        </Button>
      </form>

      {/* Always mounted: a live region that appears already filled is often not read. */}
      <div aria-live="polite">
        {view.step === "found" ? <StatusResult result={view.result} /> : null}
      </div>
      {view.step === "error" ? <ErrorState message={view.message} /> : null}
    </div>
  );
}
