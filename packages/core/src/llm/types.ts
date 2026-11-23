export interface ChatJsonRequest {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  signal: AbortSignal;
  /** Ask for a JSON object via `response_format`. Default true; turn off for models without it. */
  jsonMode?: boolean;
  /** Model-specific; never hardcoded. Groq rejects `raw` together with JSON mode. */
  reasoningFormat?: "hidden" | "parsed";
  reasoningEffort?: string;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export type ChatJsonResult =
  | {
      ok: true;
      text: string;
      usage: TokenUsage;
      latencyMs: number;
      /** `length` means the output was cut off by maxTokens. */
      finishReason: string | null;
    }
  | {
      ok: false;
      /**
       * `unavailable`: 429, 5xx, network. `timeout`: ran out of time.
       * `invalid_output`: the provider itself rejected the model's JSON (not our config's fault).
       */
      kind: "unavailable" | "timeout" | "invalid_output";
      status?: number;
      /** Seconds from the `retry-after` header on a 429, converted to ms. */
      retryAfterMs?: number;
      latencyMs: number;
    };

export interface LlmClient {
  chatJson(req: ChatJsonRequest): Promise<ChatJsonResult>;
}

/** Dependencies of `extractSignals` / `writeExplanation` (conventions/backend §2). */
export interface LlmDeps {
  llm: LlmClient;
  model: string;
  now: () => Date;
  /** Random token for the delimiter nonce. */
  random: () => string;
  jsonMode?: boolean;
  reasoningFormat?: "hidden" | "parsed";
  reasoningEffort?: string;
}

/** Absolute end of the time budget, epoch milliseconds. */
export interface CallOptions {
  deadline: number;
}
