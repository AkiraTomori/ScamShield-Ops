import { randomBytes, randomUUID } from "node:crypto";
import { BRANDS, URL_LISTS, type AnalysisEnv, type ServerEnv } from "@scamshield/shared";
import type { AnalysisDeps } from "./analysis";
import { findVerifiedMatches } from "./confirmed-indicators";
import type { ReportDeps } from "./reports";
import { createDatabase, type Database } from "./db";
import { createHttpClient } from "./http";
import { createGroqClient, GROQ_ALLOWED_HOSTS } from "./llm";
import { boundedReserve, reserveLlmCall } from "./rate-limit";

/**
 * Real dependencies, created in one place and passed into modules as parameters
 * (conventions/backend §2). The pipeline adds its own on top with `createAnalysisDeps`.
 */
export interface Deps {
  database: Database;
  now: () => Date;
}

export function createDeps(env: Pick<ServerEnv, "DATABASE_URL">): Deps {
  return { database: createDatabase(env.DATABASE_URL), now: () => new Date() };
}

/** The model provider and the P-03 cap, as both pipeline and report use them. */
function modelDeps(env: AnalysisEnv, base: Deps) {
  const http = createHttpClient({ allowedHosts: GROQ_ALLOWED_HOSTS });
  const cap = env.LLM_DAILY_CALL_CAP;
  return {
    llm: createGroqClient({ apiKey: env.GROQ_API_KEY, http }),
    llmOptions: { reasoningEffort: env.GROQ_REASONING_EFFORT },
    now: base.now,
    random: () => randomBytes(8).toString("hex"),
    ...(cap === undefined
      ? {}
      : {
          reserveLlmCall: boundedReserve(() => reserveLlmCall(base.database.db, base.now(), cap)),
        }),
  };
}

/** Real dependencies of `analyzeMessage`. The only outbound host is the LLM provider (P5). */
export function createAnalysisDeps(env: AnalysisEnv, base: Deps): AnalysisDeps {
  return {
    ...modelDeps(env, base),
    models: { signals: env.GROQ_MODEL_SIGNALS, explain: env.GROQ_MODEL_EXPLAIN },
    brands: BRANDS,
    urlLists: URL_LISTS,
    newId: randomUUID,
    verifiedIndicators: (keys) => findVerifiedMatches(keys, { db: base.database.db }),
  };
}

/** Real dependencies of `submitReport`. The case summary uses the explanation model. */
export function createReportDeps(env: AnalysisEnv, base: Deps): ReportDeps {
  return { ...modelDeps(env, base), db: base.database.db, model: env.GROQ_MODEL_EXPLAIN };
}
