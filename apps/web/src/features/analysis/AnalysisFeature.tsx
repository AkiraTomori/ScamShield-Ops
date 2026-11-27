"use client";

import { useEffect, useReducer, useRef } from "react";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { vi } from "../../copy/vi";
import { InputPanel } from "./InputPanel";
import { ResultView } from "./ResultView";
import { analysisReducer, initialState } from "./state";
import { submitAnalysis } from "./submit-analysis";

/** After this long the page says the analysis is still running (ui-pages §2.2). */
const SLOW_AFTER_MS = 5_000;

export function AnalysisFeature() {
  const [state, dispatch] = useReducer(analysisReducer, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const busy = state.status === "submitting";
  const { content, status } = state;

  // One request per stay in `submitting`; leaving the page cancels it.
  useEffect(() => {
    if (!busy) return;
    const request = new AbortController();
    const slow = setTimeout(() => dispatch({ type: "slow" }), SLOW_AFTER_MS);
    void submitAnalysis(content, { signal: request.signal }).then((outcome) =>
      dispatch({ type: "settled", outcome }),
    );
    return () => {
      clearTimeout(slow);
      request.abort();
    };
  }, [busy, content]);

  useEffect(() => {
    if (status === "invalid") textareaRef.current?.focus();
    // Scroll to the result but leave focus alone, so the verdict is not read twice.
    if (status === "result") {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultRef.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    }
  }, [status]);

  const submit = () => dispatch({ type: "submit" });
  const retry = () => {
    // The retry button disappears with its block; keep keyboard focus on the page.
    submitRef.current?.focus();
    submit();
  };

  return (
    <div className="flex flex-col gap-4">
      <InputPanel
        content={content}
        fieldError={state.status === "invalid" ? state.fieldError : undefined}
        busy={busy}
        textareaRef={textareaRef}
        submitRef={submitRef}
        onChange={(next) => dispatch({ type: "edit", content: next })}
        onSubmit={submit}
      />

      {/* Always mounted: a live region that appears already filled is often not read. */}
      <p aria-live="polite" className="sr-only">
        {state.status === "result" ? vi.verdict[state.result.verdict].label : ""}
      </p>

      {state.status === "submitting" ? (
        <div className="flex flex-col gap-2">
          <Skeleton />
          <div role="status">
            {state.slow ? <p className="text-sm text-text-muted">{vi.analysis.slow}</p> : null}
          </div>
        </div>
      ) : null}

      {state.status === "failed" ? (
        <ErrorState message={vi.analysis.failed} onRetry={retry} />
      ) : null}

      {state.status === "rateLimited" ? <ErrorState message={state.message} /> : null}

      <div ref={resultRef}>
        {state.status === "result" ? (
          <ResultView
            result={state.result}
            onRetry={retry}
            actions={
              <Button
                variant="ghost"
                onClick={() => {
                  dispatch({ type: "reset" });
                  textareaRef.current?.focus();
                }}
              >
                {vi.analysis.another}
              </Button>
            }
          />
        ) : null}
      </div>
    </div>
  );
}
