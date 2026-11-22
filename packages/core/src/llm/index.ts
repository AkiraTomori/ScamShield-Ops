export {
  createGroqClient,
  GROQ_ALLOWED_HOSTS,
  GROQ_HOST,
  GroqConfigError,
  type GroqClient,
  type GroqClientOptions,
  type GroqModelInfo,
} from "./groq";
export {
  extractSignals,
  RETRY_MIN_REMAINING_MS,
  SIGNALS_MAX_TOKENS,
  type ExtractedSignal,
  type ExtractSignalsResult,
} from "./extract-signals";
export {
  EXPLANATION_MAX_CHARS,
  EXPLANATION_MAX_TOKENS,
  filterExplanation,
  writeExplanation,
  type ExplanationRejection,
  type WriteExplanationResult,
} from "./write-explanation";
export { withRateLimitRetry, type RateLimitRetryOptions } from "./rate-limit-retry";
export { PROMPT_VERSION as SIGNALS_PROMPT_VERSION, buildSignalsPrompt } from "./prompts/signals-v1";
export {
  PROMPT_VERSION as EXPLAIN_PROMPT_VERSION,
  buildExplanationPrompt,
  type ExplanationInput,
} from "./prompts/explain-v3";
export type {
  CallOptions,
  ChatJsonRequest,
  ChatJsonResult,
  LlmClient,
  LlmDeps,
  TokenUsage,
} from "./types";
