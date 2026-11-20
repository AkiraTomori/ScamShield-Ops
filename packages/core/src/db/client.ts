import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Drizzle handle plus the lifecycle helpers callers need. */
export interface Database {
  db: ReturnType<typeof drizzle<typeof schema>>;
  /** Resolves when the database answers `SELECT 1`; rejects otherwise. */
  ping: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Create a client for one function instance. Callers keep it at module level and reuse it
 * (system-design §4); do not create one per request.
 *
 * `prepare: false` is required behind Supabase's transaction pooler and is harmless against a
 * plain Postgres (Docker), so the same code works for both connection strings.
 */
export function createDatabase(url: string): Database {
  const sql = postgres(url, {
    max: 3,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 20,
    onnotice: () => {},
  });
  return {
    db: drizzle(sql, { schema }),
    ping: async () => {
      await sql`SELECT 1`;
    },
    close: () => sql.end({ timeout: 5 }),
  };
}
