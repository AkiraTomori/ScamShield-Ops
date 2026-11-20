import { createDeps, type Deps } from "@scamshield/core";

// One client per function instance and connection string (system-design §4), not one per request.
const cache = new Map<string, Deps>();

export function getDeps(env: { DATABASE_URL: string }): Deps {
  const existing = cache.get(env.DATABASE_URL);
  if (existing) return existing;
  const created = createDeps(env);
  cache.set(env.DATABASE_URL, created);
  return created;
}

/** For tests and graceful shutdown. */
export async function closeAllDeps(): Promise<void> {
  const all = [...cache.values()];
  cache.clear();
  await Promise.all(all.map((deps) => deps.database.close()));
}
