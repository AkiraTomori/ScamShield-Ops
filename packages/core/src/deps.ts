import type { ServerEnv } from "@scamshield/shared";
import { createDatabase, type Database } from "./db";

/**
 * Real dependencies, created in one place and passed into modules as parameters
 * (conventions/backend §2). Later slices add the LLM client, the outbound HTTP client, etc.
 */
export interface Deps {
  database: Database;
  now: () => Date;
}

export function createDeps(env: Pick<ServerEnv, "DATABASE_URL">): Deps {
  return { database: createDatabase(env.DATABASE_URL), now: () => new Date() };
}
