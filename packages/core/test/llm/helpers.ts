import { vi } from "vitest";
import type { ChatJsonRequest, ChatJsonResult, LlmDeps } from "../../src/llm";

export const okText = (text: string, latencyMs = 100): ChatJsonResult => ({
  ok: true,
  text,
  usage: { input: 10, output: 5 },
  latencyMs,
  finishReason: "stop",
});

/** Fake LLM that replays scripted results and records requests. No network. */
export function fakeLlm(script: ChatJsonResult[]) {
  const calls: ChatJsonRequest[] = [];
  const chatJson = vi.fn(async (req: ChatJsonRequest) => {
    calls.push(req);
    const next = script[calls.length - 1] ?? script[script.length - 1];
    if (!next) throw new Error("empty script");
    return next;
  });
  return { calls, chatJson };
}

export function makeDeps(
  llm: { chatJson: LlmDeps["llm"]["chatJson"] },
  clock: { t: number } = { t: 1_000_000 },
): LlmDeps {
  return { llm, model: "test-model", now: () => new Date(clock.t), random: () => "abc123" };
}
