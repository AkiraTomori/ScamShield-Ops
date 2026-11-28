import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { disagreesWithEngine } from "../cases/agreement";
import { recordConfirmedIndicators } from "../confirmed-indicators/record";
import {
  analyses,
  analysisIndicators,
  cases,
  confirmedIndicators,
  decisions,
  staffUsers,
} from "../db/schema";
import type { Db } from "../rate-limit";
import { generateSecretCode, hashSecret, normalizeSecretCode } from "../reports/secret";
import { RULES_VERSION } from "../verdict";
import { buildSeedAnalysis, SEED_CASES } from "./seed-data";

/** Puts the seed data back to its first state (demo-data §3, data-model §7, SO-10-AC04). */

/** The account the closed seed cases are decided by. */
const SEED_STAFF = "judge1";
/** Marks what no model and no pipeline run produced. */
const SEED_VERSION = "seed";
const SPREAD_MS = 7 * 86_400_000;
const ANALYSIS_BEFORE_CASE_MS = 60_000;
const DECISION_AFTER_CASE_MS = 2 * 3_600_000;

/** Its message names what is wrong, never a secret value. */
export class DemoSeedError extends Error {}

export interface DemoSummary {
  deleted: { confirmedIndicators: number; decisions: number; cases: number; analyses: number };
  inserted: {
    analyses: number;
    indicators: number;
    cases: number;
    decisions: number;
    confirmedIndicators: number;
  };
}

/**
 * The secret of SC-0001 (DM-01) in its stored form; undefined when none is set. Throws for a value
 * no reporter could type in.
 */
export function parseDemoLookupSecret(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const secret = normalizeSecretCode(raw);
  if (!secret) {
    throw new DemoSeedError("DEMO_LOOKUP_SECRET needs 8 letters or digits, without U.");
  }
  return secret;
}

/**
 * Deletes everything that belongs to a seed case and inserts the 24 cases again, in one
 * transaction. Rows of real cases and `staff_users` are not touched.
 */
export async function resetDemoData(
  deps: { db: Db; now: () => Date },
  opts: { lookupSecret?: string } = {},
): Promise<DemoSummary> {
  const lookupSecret = parseDemoLookupSecret(opts.lookupSecret);
  const now = deps.now().getTime();
  const step = SPREAD_MS / (SEED_CASES.length + 1);

  // Hashed before the transaction: scrypt is slow on purpose.
  const rows = await Promise.all(
    SEED_CASES.map(async (seed, index) => {
      const createdAt = new Date(now - (SEED_CASES.length - index) * step);
      return {
        seed,
        built: buildSeedAnalysis(seed),
        analysisId: randomUUID(),
        caseId: randomUUID(),
        createdAt,
        decidedAt: seed.decision && new Date(createdAt.getTime() + DECISION_AFTER_CASE_MS),
        // Only SC-0001 can be looked up; the other codes are thrown away.
        secretHash: await hashSecret(
          index === 0 && lookupSecret ? lookupSecret : generateSecretCode(),
        ),
      };
    }),
  );

  return deps.db.transaction(async (tx): Promise<DemoSummary> => {
    const [staff] = await tx
      .select({ id: staffUsers.id })
      .from(staffUsers)
      .where(eq(staffUsers.username, SEED_STAFF));
    if (!staff) {
      throw new DemoSeedError(`The account ${SEED_STAFF} does not exist: run demo:seed first.`);
    }

    const seedCaseIds = tx.select({ id: cases.id }).from(cases).where(eq(cases.isSeed, true));
    // Locked first: a conclusion being saved on a seed case finishes before the deletes, or finds
    // the case gone. Without this it could add a confirmed indicator after they were deleted.
    await seedCaseIds.for("update");

    // In this order (demo-data §3.2): the indicator's FK to its case does not cascade.
    const deletedIndicators = await tx
      .delete(confirmedIndicators)
      .where(inArray(confirmedIndicators.sourceCaseId, seedCaseIds))
      .returning({ id: confirmedIndicators.id });
    const deletedDecisions = await tx
      .delete(decisions)
      .where(inArray(decisions.caseId, seedCaseIds))
      .returning({ id: decisions.caseId });
    const deletedCases = await tx
      .delete(cases)
      .where(eq(cases.isSeed, true))
      .returning({ id: cases.id });
    const deletedAnalyses = await tx
      .delete(analyses)
      .where(eq(analyses.isSeed, true))
      .returning({ id: analyses.id });

    await tx.insert(analyses).values(
      rows.map(({ seed, built, analysisId, createdAt }) => ({
        id: analysisId,
        redactedContent: seed.content,
        redactionCounts: { otp: 0, password: 0, card: 0 },
        verdict: seed.expected.verdict,
        rule: seed.expected.rule,
        inconclusiveReason: built.inconclusiveReason,
        riskTypes: seed.expected.riskTypes,
        details: built.details,
        promptVersion: SEED_VERSION,
        rulesVersion: RULES_VERSION,
        trace: { seed: true },
        latencyMs: 0,
        isSeed: true,
        createdAt: new Date(createdAt.getTime() - ANALYSIS_BEFORE_CASE_MS),
      })),
    );
    const indicators = rows.flatMap(({ built, analysisId }) =>
      built.matchable.map((indicator) => ({ ...indicator, analysisId })),
    );
    await tx.insert(analysisIndicators).values(indicators);

    await tx.insert(cases).values(
      rows.map(({ seed, analysisId, caseId, createdAt, decidedAt, secretHash }) => ({
        id: caseId,
        code: seed.code,
        analysisId,
        status: seed.decision ? "closed" : "pending_review",
        channel: seed.channel,
        reporterNote: seed.note,
        secretHash,
        engineVerdict: seed.expected.verdict,
        riskTypes: seed.expected.riskTypes,
        aiSummary: seed.aiSummary,
        summaryPromptVersion: seed.aiSummary ? SEED_VERSION : null,
        isSeed: true,
        createdAt,
        updatedAt: decidedAt ?? createdAt,
        closedAt: decidedAt,
      })),
    );

    const concluded = rows.flatMap(({ seed, caseId, decidedAt }) =>
      seed.decision && decidedAt
        ? [
            {
              caseId,
              decision: seed.decision.decision,
              reason: seed.decision.reason,
              decidedBy: staff.id,
              decidedAt,
              engineVerdict: seed.expected.verdict,
              disagreesWithEngine: disagreesWithEngine(
                seed.decision.decision,
                seed.expected.verdict,
              ),
            },
          ]
        : [],
    );
    await tx.insert(decisions).values(concluded);

    // The same write as a real decision, so the same exclusions apply (XM-01, XM-04).
    let confirmed = 0;
    for (const { caseId, decision, decidedAt } of concluded) {
      if (decision === "confirmed_scam") {
        confirmed += await recordConfirmedIndicators(tx, caseId, staff.id, decidedAt);
      }
    }

    return {
      deleted: {
        confirmedIndicators: deletedIndicators.length,
        decisions: deletedDecisions.length,
        cases: deletedCases.length,
        analyses: deletedAnalyses.length,
      },
      inserted: {
        analyses: rows.length,
        indicators: indicators.length,
        cases: rows.length,
        decisions: concluded.length,
        confirmedIndicators: confirmed,
      },
    };
  });
}
