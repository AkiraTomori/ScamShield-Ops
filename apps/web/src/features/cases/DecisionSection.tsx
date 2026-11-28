"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { DecisionRecord } from "@scamshield/shared";
import type { Decision } from "@scamshield/shared/enums";
import { DECISION_ERROR_MESSAGE_VI, DecisionRequest } from "@scamshield/shared/ops";
import { ErrorState } from "../../components/ErrorState";
import { TextArea } from "../../components/TextArea";
import { vi } from "../../copy/vi";
import { formatUpdatedAt } from "../lookup/format-time";
import { DecisionCard } from "./DecisionCard";
import { DecisionForm } from "./DecisionForm";
import { caseHref, LIST_PATH } from "./list-url";
import { submitDecision } from "./submit-decision";

/** Long enough to read why the page is about to change. */
const SIGN_IN_AFTER_MS = 2_000;

type Problem = "none" | "taken" | "signed_out" | "not_found" | "failed";

/**
 * The form while a case waits, the card once it is closed. One component for both, in one place, so
 * that what was being typed survives the refresh that brings someone else's decision (fraudops §5.4).
 */
export function DecisionSection({
  caseCode,
  decision,
}: {
  caseCode: string;
  decision: DecisionRecord | null;
}) {
  const t = vi.ops.decision;
  const id = useId();
  const router = useRouter();
  const [choice, setChoice] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [fields, setFields] = useState<{ decision?: string; reason?: string }>({});
  const [problem, setProblem] = useState<Problem>("none");
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (problem !== "signed_out") return;
    const next = encodeURIComponent(caseHref(caseCode));
    // A full load: nothing rendered with the old session should be reused.
    const timer = setTimeout(() => {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/ops/dang-nhap?next=${next}`);
    }, SIGN_IN_AFTER_MS);
    return () => clearTimeout(timer);
  }, [problem, caseCode]);

  async function save() {
    const body = DecisionRequest.safeParse({ decision: choice, reason });
    if (!body.success) {
      const issues = new Set(body.error.issues.map((issue) => issue.path[0]));
      setFields({
        decision: issues.has("decision") ? DECISION_ERROR_MESSAGE_VI.decision : undefined,
        reason: issues.has("reason") ? DECISION_ERROR_MESSAGE_VI.reason : undefined,
      });
      return;
    }
    inFlight.current = true;
    setSending(true);
    setFields({});
    setProblem("none");
    const outcome = await submitDecision(caseCode, body.data);
    if (outcome.kind === "saved") {
      // The server renders the card; the button stays busy until then.
      router.refresh();
      return;
    }
    inFlight.current = false;
    setSending(false);
    if (outcome.kind === "invalid") setFields(outcome.fields);
    else if (outcome.kind === "taken") {
      setProblem("taken");
      router.refresh();
    } else if (outcome.kind === "signed_out" || outcome.kind === "not_found") {
      setProblem(outcome.kind);
    } else setProblem("failed");
  }

  const taken = problem === "taken";

  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-card border border-border p-4"
    >
      <h2 id={id} className="text-lg font-bold">
        {t.heading}
      </h2>

      {/* Always mounted: a live region that appears already filled is often not read. */}
      <div aria-live="polite" className="flex flex-col gap-2">
        {taken ? (
          <p className="font-semibold">
            {decision
              ? t.takenBy(decision.decidedBy, formatUpdatedAt(decision.decidedAt))
              : t.takenPending}
          </p>
        ) : null}
        {problem === "signed_out" ? <p className="font-semibold">{t.expired}</p> : null}
      </div>

      {decision ? <DecisionCard decision={decision} /> : null}

      {!decision && !taken ? (
        <DecisionForm
          choice={choice}
          reason={reason}
          sending={sending}
          choiceError={fields.decision}
          reasonError={fields.reason}
          error={problem === "failed" ? t.failed : undefined}
          onChoice={setChoice}
          onReason={setReason}
          onSubmit={() => {
            if (!inFlight.current) void save();
          }}
        />
      ) : null}

      {taken && reason ? (
        <TextArea id="decision-unsaved" label={t.unsavedReason} rows={4} readOnly value={reason} />
      ) : null}

      {problem === "not_found" ? (
        <>
          <ErrorState message={t.notFound} />
          <Link href={LIST_PATH} className="text-primary underline">
            {vi.ops.detail.backToList}
          </Link>
        </>
      ) : null}
    </section>
  );
}
