import type { AnalysisResult } from "@scamshield/shared/analysis";
import { ERROR_MESSAGE_VI } from "@scamshield/shared/errors";
import { INPUT_ERROR_MESSAGE_VI, normalizeInput } from "@scamshield/shared/input";
import type { AnalysisOutcome } from "./submit-analysis";

/** Client state machine of scamshield-ui §3.1. Pure: the component only dispatches. */
export type State =
  | { status: "editing"; content: string }
  | { status: "invalid"; content: string; fieldError: string }
  | { status: "submitting"; content: string; slow: boolean }
  /** `reporting`: a report is on its way, so nothing may drop the result it belongs to. */
  | { status: "result"; content: string; result: AnalysisResult; reporting?: boolean }
  /** The codes are on screen and the secret one is never shown again (report-flow §5.2). */
  | { status: "reported"; content: string; result: AnalysisResult }
  | { status: "rateLimited"; content: string; message: string }
  | { status: "failed"; content: string };

export type Action =
  /** Typing, or picking a sample. */
  | { type: "edit"; content: string }
  /** The check button, or retry. */
  | { type: "submit" }
  /** The wait has passed 5 seconds. */
  | { type: "slow" }
  | { type: "settled"; outcome: AnalysisOutcome }
  /** "Check another message". */
  | { type: "reset" }
  | { type: "reportStarted" }
  /** `secretShown`: this answer put a new secret code on screen. */
  | { type: "reportSettled"; secretShown: boolean };

export const initialState: State = { status: "editing", content: "" };

export function analysisReducer(state: State, action: Action): State {
  if (state.status === "submitting") {
    // One request at a time: only the wait itself and its answer move the state.
    if (action.type === "slow") return { ...state, slow: true };
    if (action.type !== "settled") return state;
    return settle(state, state.content, action.outcome);
  }

  if (state.status === "reported") {
    // Only "check another message" (after its confirmation) leaves the codes behind.
    return action.type === "reset" ? initialState : state;
  }
  if (state.status === "result" && state.reporting) {
    if (action.type !== "reportSettled") return state;
    const { content, result } = state;
    return action.secretShown
      ? { status: "reported", content, result }
      : { status: "result", content, result };
  }

  switch (action.type) {
    case "reportStarted":
      return state.status === "result" ? { ...state, reporting: true } : state;
    case "edit":
      return { status: "editing", content: action.content };
    case "reset":
      return initialState;
    case "submit": {
      const { content } = state;
      const input = normalizeInput(content);
      return input.ok
        ? { status: "submitting", content, slow: false }
        : { status: "invalid", content, fieldError: INPUT_ERROR_MESSAGE_VI[input.code] };
    }
    default:
      return state;
  }
}

function settle(state: State, content: string, outcome: AnalysisOutcome): State {
  switch (outcome.kind) {
    case "ok":
      return { status: "result", content, result: outcome.result };
    case "invalid":
      return { status: "invalid", content, fieldError: outcome.message };
    case "rate_limited":
      return { status: "rateLimited", content, message: ERROR_MESSAGE_VI.rate_limited };
    case "failed":
      return { status: "failed", content };
    case "aborted":
      return state;
  }
}
