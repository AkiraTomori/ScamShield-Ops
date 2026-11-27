import { describe, expect, it } from "vitest";
import { ERROR_MESSAGE_VI, INPUT_ERROR_MESSAGE_VI, type AnalysisResult } from "@scamshield/shared";
import {
  analysisReducer,
  initialState,
  type Action,
  type State,
} from "../../src/features/analysis/state";

// Transitions of scamshield-ui §3.1.
const RESULT = { analysisId: "a", verdict: "no_signal" } as AnalysisResult;

const run = (...actions: Action[]): State => actions.reduce(analysisReducer, initialState);
const typed = (content: string): Action => ({ type: "edit", content });
const submit: Action = { type: "submit" };
const settled = (outcome: Extract<Action, { type: "settled" }>["outcome"]): Action => ({
  type: "settled",
  outcome,
});

const sending = run(typed("tin"), submit);
const answered = run(typed("tin"), submit, settled({ kind: "ok", result: RESULT }));
const limited = run(typed("tin"), submit, settled({ kind: "rate_limited" }));
const failed = run(typed("tin"), submit, settled({ kind: "failed" }));

describe("analysis page state", () => {
  it("starts with an empty box", () => {
    expect(initialState).toEqual({ status: "editing", content: "" });
  });

  it.each([
    ["empty", "   ", INPUT_ERROR_MESSAGE_VI.empty],
    ["too long", "a".repeat(2001), INPUT_ERROR_MESSAGE_VI.too_long],
  ])("SO-01-AC02: rejects %s content without sending it", (_, content, fieldError) => {
    expect(run(typed(content), submit)).toEqual({ status: "invalid", content, fieldError });
  });

  it("clears the error as soon as the user types", () => {
    expect(run(typed(" "), submit, typed("a"))).toEqual({ status: "editing", content: "a" });
  });

  it("sends valid content as typed", () => {
    expect(sending).toEqual({ status: "submitting", content: "tin", slow: false });
  });

  it("allows one request at a time: typing, samples and submit are ignored meanwhile", () => {
    expect(analysisReducer(sending, typed("khác"))).toBe(sending);
    expect(analysisReducer(sending, submit)).toBe(sending);
    expect(analysisReducer(sending, { type: "reset" })).toBe(sending);
  });

  it("SO-03-AC06: marks a long wait, only while waiting", () => {
    expect(analysisReducer(sending, { type: "slow" })).toMatchObject({ slow: true });
    expect(analysisReducer(answered, { type: "slow" })).toBe(answered);
  });

  it("SO-01-AC01: shows the result and keeps the content", () => {
    expect(answered).toEqual({ status: "result", content: "tin", result: RESULT });
  });

  it("lets the user check the same content again from a result", () => {
    expect(analysisReducer(answered, submit)).toEqual(sending);
  });

  it("hides the result once the content changes", () => {
    expect(analysisReducer(answered, typed("tin 2"))).toEqual({
      status: "editing",
      content: "tin 2",
    });
  });

  it("empties the box for 'check another message'", () => {
    expect(analysisReducer(answered, { type: "reset" })).toEqual(initialState);
  });

  it("SO-01-AC04: keeps the content when rate limited, and lets the user try again", () => {
    expect(limited).toEqual({
      status: "rateLimited",
      content: "tin",
      message: ERROR_MESSAGE_VI.rate_limited,
    });
    expect(analysisReducer(limited, submit)).toEqual(sending);
    expect(analysisReducer(limited, typed("t"))).toEqual({ status: "editing", content: "t" });
  });

  it("keeps the content on failure, and retries that same content", () => {
    expect(failed).toEqual({ status: "failed", content: "tin" });
    expect(analysisReducer(failed, submit)).toEqual(sending);
    expect(analysisReducer(failed, typed("t"))).toEqual({ status: "editing", content: "t" });
  });

  it("SO-01-AC02: shows a 400 from the server as a field error", () => {
    expect(analysisReducer(sending, settled({ kind: "invalid", message: "Lỗi" }))).toEqual({
      status: "invalid",
      content: "tin",
      fieldError: "Lỗi",
    });
  });

  it("ignores an answer that arrives when nothing is being sent, and a cancelled one", () => {
    expect(analysisReducer(answered, settled({ kind: "failed" }))).toBe(answered);
    expect(analysisReducer(sending, settled({ kind: "aborted" }))).toBe(sending);
  });
});
