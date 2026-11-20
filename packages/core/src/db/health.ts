import type { HealthFailureKind, HealthResponse } from "@scamshield/shared";
import { logEvent, type LogFields } from "../log";

export const HEALTH_TIMEOUT_MS = 2000;

export interface HealthCheckInput {
  /** `null` means the configuration needed to reach the database is missing. */
  ping: (() => Promise<void>) | null;
  version: string;
  now: () => Date;
  timeoutMs?: number;
  log?: (fields: LogFields) => void;
}

export interface HealthCheckResult {
  body: HealthResponse;
  /** Kind of failure, or null when healthy. Never the raw error. */
  failure: HealthFailureKind | null;
}

class PingTimeout extends Error {}

function withTimeout(work: Promise<void>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PingTimeout()), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Decide the health of the database connection (system-design §5). The caller's error is
 * reduced to a kind (`timeout`, `connect_failed`, `config_missing`); neither the body nor the log
 * ever carries the original message, which can contain host, user or connection string.
 */
export async function checkHealth(input: HealthCheckInput): Promise<HealthCheckResult> {
  const log = input.log ?? logEvent;
  const started = Date.now();
  const time = input.now().toISOString();

  let failure: HealthFailureKind | null = null;
  if (input.ping === null) {
    failure = "config_missing";
  } else {
    try {
      await withTimeout(input.ping(), input.timeoutMs ?? HEALTH_TIMEOUT_MS);
    } catch (error) {
      failure = error instanceof PingTimeout ? "timeout" : "connect_failed";
    }
  }

  if (failure === null) {
    return { body: { status: "ok", db: "ok", version: input.version, time }, failure };
  }
  log({ event: "health_check_failed", code: failure, durationMs: Date.now() - started });
  return {
    body: { status: "degraded", db: "unavailable", version: input.version, time },
    failure,
  };
}
