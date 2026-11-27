import type { LogFields } from "../log";
import { GroqConfigError } from "./groq";
import type { LlmClient } from "./types";

export interface GuardOptions {
  /** P-03: reserves one model call against the daily cap. Unset: no cap. */
  reserve?: () => Promise<boolean>;
  log: (fields: LogFields) => void;
  /** Called for every request actually sent to the provider. */
  onCall?: () => void;
}

/** Applies the daily cap to a client and logs its failures by status, never by content. */
export function guardLlm(client: LlmClient, opts: GuardOptions): LlmClient {
  return {
    async chatJson(request) {
      if (opts.reserve && !(await opts.reserve())) {
        return { ok: false, kind: "unavailable", latencyMs: 0 };
      }
      opts.onCall?.();
      let reply;
      try {
        reply = await client.chatJson(request);
      } catch (error) {
        // 401 is a bad key, 404 a wrong model name. The status only: never the message.
        if (error instanceof GroqConfigError) {
          opts.log({ event: "llm_call_failed", code: `config_${error.status}` });
        }
        throw error;
      }
      // The HTTP status tells a rate limit apart from an outage; never any content.
      if (!reply.ok) {
        opts.log({
          event: "llm_call_failed",
          code: `${reply.kind}_${reply.status ?? "no_status"}`,
        });
      }
      return reply;
    },
  };
}
