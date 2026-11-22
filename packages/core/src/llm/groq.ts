import { z } from "zod";
import type { HttpClient } from "../http";
import { HttpError } from "../http";
import type { ChatJsonRequest, ChatJsonResult, LlmClient } from "./types";

export const GROQ_HOST = "api.groq.com";
export const GROQ_ALLOWED_HOSTS = [GROQ_HOST] as const;
const BASE_URL = `https://${GROQ_HOST}/openai/v1`;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 1_000_000;

/** Our own mistake (bad key, wrong model name, rejected parameter). Not a provider outage. */
export class GroqConfigError extends Error {
  readonly status: number;
  constructor(status: number, code: string | undefined) {
    // Never echo the provider's message or anything from the request: it may carry the key.
    super(
      `Groq rejected the request (HTTP ${status}${code ? `, code ${code}` : ""}). ` +
        "Check GROQ_API_KEY, the model name and the request parameters.",
    );
    this.name = "GroqConfigError";
    this.status = status;
  }
}

const ChatResponse = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable().optional() }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).optional(),
});

const ErrorBody = z.object({
  error: z.object({ code: z.string().optional(), type: z.string().optional() }).passthrough(),
});

const ModelsResponse = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        owned_by: z.string().optional(),
        active: z.boolean().optional(),
        context_window: z.number().optional(),
      })
      .passthrough(),
  ),
});
export type GroqModelInfo = z.infer<typeof ModelsResponse>["data"][number];

export interface GroqClientOptions {
  apiKey: string;
  http: HttpClient;
  timeoutMs?: number;
  /** Injectable for tests. */
  monotonicNow?: () => number;
}

export interface GroqClient extends LlmClient {
  listModels(signal?: AbortSignal): Promise<GroqModelInfo[]>;
}

export function createGroqClient(opts: GroqClientOptions): GroqClient {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = opts.monotonicNow ?? (() => performance.now());
  const headers = {
    authorization: `Bearer ${opts.apiKey}`,
    "content-type": "application/json",
  };

  return {
    async chatJson(req: ChatJsonRequest): Promise<ChatJsonResult> {
      const started = now();
      const elapsed = () => Math.round(now() - started);
      const body: Record<string, unknown> = {
        model: req.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        temperature: 0,
        max_completion_tokens: req.maxTokens,
      };
      if (req.jsonMode !== false) body.response_format = { type: "json_object" };
      if (req.reasoningFormat) body.reasoning_format = req.reasoningFormat;
      if (req.reasoningEffort) body.reasoning_effort = req.reasoningEffort;

      let response;
      try {
        response = await opts.http.request(`${BASE_URL}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          timeoutMs,
          signal: req.signal,
          maxBytes: MAX_RESPONSE_BYTES,
        });
      } catch (error) {
        if (error instanceof HttpError) {
          if (error.kind === "timeout" || error.kind === "aborted") {
            return { ok: false, kind: "timeout", latencyMs: elapsed() };
          }
          if (error.kind === "network" || error.kind === "too_large") {
            return { ok: false, kind: "unavailable", latencyMs: elapsed() };
          }
        }
        throw error; // host not allowed / bad URL: a bug on our side
      }

      const { status } = response;
      if (status === 200) {
        const parsed = ChatResponse.safeParse(safeJson(response.text));
        if (!parsed.success)
          return { ok: false, kind: "unavailable", status, latencyMs: elapsed() };
        const choice = parsed.data.choices[0];
        return {
          ok: true,
          text: choice?.message.content ?? "",
          usage: {
            input: parsed.data.usage?.prompt_tokens ?? 0,
            output: parsed.data.usage?.completion_tokens ?? 0,
          },
          latencyMs: elapsed(),
          finishReason: choice?.finish_reason ?? null,
        };
      }

      const code = errorCode(response.text);
      if (status === 400 && code === "json_validate_failed") {
        // The model produced JSON Groq could not validate: bad output, not bad configuration.
        return { ok: false, kind: "invalid_output", status, latencyMs: elapsed() };
      }
      if (status === 429 || status === 408 || status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        return {
          ok: false,
          kind: "unavailable",
          status,
          ...(Number.isFinite(retryAfter) && retryAfter >= 0
            ? { retryAfterMs: Math.round(retryAfter * 1000) }
            : {}),
          latencyMs: elapsed(),
        };
      }
      throw new GroqConfigError(status, code);
    },

    async listModels(signal) {
      let response;
      try {
        response = await opts.http.request(`${BASE_URL}/models`, {
          method: "GET",
          headers,
          timeoutMs,
          signal,
          maxBytes: MAX_RESPONSE_BYTES,
        });
      } catch (error) {
        if (error instanceof HttpError) throw new Error(`Groq model list failed (${error.kind})`);
        throw error;
      }
      if (response.status !== 200)
        throw new GroqConfigError(response.status, errorCode(response.text));
      const parsed = ModelsResponse.safeParse(safeJson(response.text));
      if (!parsed.success) throw new Error("Groq model list has an unexpected shape");
      return parsed.data.data;
    },
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function errorCode(text: string): string | undefined {
  const parsed = ErrorBody.safeParse(safeJson(text));
  const code = parsed.success ? parsed.data.error.code : undefined;
  return code && /^[a-z0-9_]{1,64}$/.test(code) ? code : undefined;
}
