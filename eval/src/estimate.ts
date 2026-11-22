import {
  buildExplanationPrompt,
  buildSignalsPrompt,
  EXPLANATION_MAX_TOKENS,
  SIGNALS_MAX_TOKENS,
} from "@scamshield/core";
import type { EvalCase } from "./case";
import { labelExplanationInput } from "./explanation-input";

/** Rough Vietnamese text density: about 3 characters per token. An estimate, not a measurement. */
const CHARS_PER_TOKEN = 3;

export interface Estimate {
  models: number;
  cases: number;
  runs: number;
  calls: number;
  inputTokens: number;
  /** Upper bound: every call uses its full max_tokens. */
  outputTokensMax: number;
  cost: { min: number; max: number } | null;
}

export function estimateRun(opts: {
  cases: readonly EvalCase[];
  models: number;
  runs: number;
  prices?: { inPerMillion: number; outPerMillion: number }[];
}): Estimate {
  const tokens = (chars: number) => Math.ceil(chars / CHARS_PER_TOKEN);
  let inputPerPass = 0;
  for (const c of opts.cases) {
    const signals = buildSignalsPrompt(c.content, "0000000000000000");
    const explain = buildExplanationPrompt(labelExplanationInput(c), "0000000000000000");
    inputPerPass +=
      tokens(signals.system.length + signals.user.length) +
      tokens(explain.system.length + explain.user.length);
  }
  const passes = opts.models * opts.runs;
  const calls = opts.cases.length * passes * 2;
  const inputTokens = inputPerPass * passes;
  const outputTokensMax =
    opts.cases.length * passes * (SIGNALS_MAX_TOKENS + EXPLANATION_MAX_TOKENS);

  // One price entry per model. `min` = input only; `max` = input plus every call using max_tokens.
  let cost: Estimate["cost"] = null;
  if (opts.prices && opts.prices.length > 0) {
    const outputPerModel =
      opts.cases.length * opts.runs * (SIGNALS_MAX_TOKENS + EXPLANATION_MAX_TOKENS);
    const min = opts.prices.reduce(
      (a, p) => a + (inputPerPass * opts.runs * p.inPerMillion) / 1e6,
      0,
    );
    const outMax = opts.prices.reduce((a, p) => a + (outputPerModel * p.outPerMillion) / 1e6, 0);
    cost = { min, max: min + outMax };
  }
  return {
    models: opts.models,
    cases: opts.cases.length,
    runs: opts.runs,
    calls,
    inputTokens,
    outputTokensMax,
    cost,
  };
}
