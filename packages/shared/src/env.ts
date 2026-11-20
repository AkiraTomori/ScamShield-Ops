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
