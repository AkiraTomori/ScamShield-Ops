import { z } from "zod";

/** Empty string in .env (e.g. `GROQ_API_KEY=`) means "not set". */
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const postgresUrl = z
  .string()
  .min(1)
  .refine((value) => /^postgres(ql)?:\/\//.test(value), {
    message: "must be a postgres:// or postgresql:// connection string",
  });

/**
 * Server-side environment (system-design §7). Server only: never import into client components.
 *
 * Every secret lives in the root `.env` (gitignored) or in the deploy platform's variables.
 * To rotate a key: edit `.env` and restart `npm run dev`; on Vercel edit the variable and redeploy.
 */
export const ServerEnv = z.object({
  /** Runtime connection. Supabase: transaction pooler. Local: the Docker Postgres. */
  DATABASE_URL: postgresUrl,
  /** Migrations only (direct or session connection). Falls back to DATABASE_URL when unset. */
  DATABASE_URL_MIGRATE: z.preprocess((v) => (v === "" ? undefined : v), postgresUrl.optional()),
  /** Needed from the pipeline slice onwards; optional for the foundation slice. */
  GROQ_API_KEY: optionalString,
});
export type ServerEnv = z.infer<typeof ServerEnv>;

/** What the running app needs to reach the database. Excludes migration-only and unrelated keys. */
export const RuntimeDatabaseEnv = ServerEnv.pick({ DATABASE_URL: true });
export type RuntimeDatabaseEnv = z.infer<typeof RuntimeDatabaseEnv>;

/**
 * Parse only the variables /api/health depends on (DATABASE_URL). A malformed
 * DATABASE_URL_MIGRATE or GROQ_API_KEY must never degrade the health check.
 */
export function parseRuntimeDatabaseEnv(source: Record<string, string | undefined>) {
  return RuntimeDatabaseEnv.safeParse(source);
}

/**
 * Parse the full environment source. Returns a result instead of throwing so callers can degrade
 * (e.g. /api/health answers 503 `config_missing`). Issues never echo the offending values.
 */
export function parseServerEnv(source: Record<string, string | undefined>) {
  return ServerEnv.safeParse(source);
}

const optionalPositiveInt = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

/**
 * Variables of the analysis pipeline (analysis-pipeline §11). Parsed separately from the health
 * check, which must keep working without any of them.
 */
export const AnalysisEnv = z.object({
  DATABASE_URL: postgresUrl,
  GROQ_API_KEY: z.string().min(1),
  /** Q-08: switching to the fallback model is a change here, not in code. */
  GROQ_MODEL_SIGNALS: z.string().min(1),
  GROQ_MODEL_EXPLAIN: z.string().min(1),
  /** Defaults to `low`, the setting measured in research A.6. */
  GROQ_REASONING_EFFORT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).default("low"),
  ),
  /** Secret for HMAC-SHA256 of the client IP. */
  RATE_LIMIT_SALT: z.string().min(32),
  SAFE_BROWSING_API_KEY: optionalString,
  /** P-03: unset means no cap. */
  LLM_DAILY_CALL_CAP: optionalPositiveInt,
});
export type AnalysisEnv = z.infer<typeof AnalysisEnv>;

export function parseAnalysisEnv(source: Record<string, string | undefined>) {
  return AnalysisEnv.safeParse(source);
}
