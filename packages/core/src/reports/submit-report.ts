import { AnalysisDetails, standardizeText, type ReportRequest } from "@scamshield/shared";
import { eq } from "drizzle-orm";
import { isUniqueViolation } from "../db";
import { analyses, cases } from "../db/schema";
import { guardLlm, summarizeCase, type LlmClient, type LlmDeps } from "../llm";
import { logEvent, type LogFields } from "../log";
import type { Db } from "../rate-limit";
import { redactNote } from "../redaction";
import { formatSecretCode, generateSecretCode, hashSecret, type RandomInt } from "./secret";

/** Time allowed for the AI summary (RP-03). */
export const SUMMARY_TIMEOUT_MS = 8_000;
/** `cases.reporter_note` (RP-01): redaction labels can lengthen a 500-character note. */
const MAX_STORED_NOTE_CHARS = 1000;

export interface ReportDeps {
  db: Db;
  llm: LlmClient;
  model: string;
  llmOptions?: Pick<LlmDeps, "jsonMode" | "reasoningFormat" | "reasoningEffort">;
  now: () => Date;
  /** Random token for the delimiter nonce. */
  random: () => string;
  randomInt?: RandomInt;
  /** P-03: reserves one model call against the daily cap. Unset: no cap. */
  reserveLlmCall?: () => Promise<boolean>;
  log?: (fields: LogFields) => void;
}

export type SubmitReportResult =
  /** `secretCode` is returned here once and never again; only its hash is stored. */
  | { kind: "created"; caseCode: string; secretCode: string }
  | { kind: "already_reported"; caseCode: string }
  | { kind: "analysis_not_found" };

/** Turns one analysis into a case (SO-04, SO-05; report-flow §2.1). */
export async function submitReport(
  analysisId: string,
  req: ReportRequest,
  deps: ReportDeps,
): Promise<SubmitReportResult> {
  const [analysis] = await deps.db
    .select({
      redactedContent: analyses.redactedContent,
      verdict: analyses.verdict,
      riskTypes: analyses.riskTypes,
      details: analyses.details,
    })
    .from(analyses)
    .where(eq(analyses.id, analysisId));
  if (!analysis) return { kind: "analysis_not_found" };

  // Before the model: sending the same report again costs nothing (SO-04-AC03).
  const reported = await existingCase(analysisId, deps.db);
  if (reported) return { kind: "already_reported", caseCode: reported };

  // The note is user content like the message: redacted before storage and the model (SO-01-AC03).
  const note = prepareNote(req.note);
  // Outside any transaction: never hold one open while waiting for the model (data-model §4).
  const summary = await summarize(analysisId, analysis, req, note, deps);

  const secret = generateSecretCode(deps.randomInt);
  const secretHash = await hashSecret(secret);
  try {
    const [created] = await deps.db
      .insert(cases)
      .values({
        analysisId,
        channel: req.channel,
        reporterNote: note,
        secretHash,
        engineVerdict: analysis.verdict,
        riskTypes: analysis.riskTypes,
        aiSummary: summary?.value ?? null,
        summaryPromptVersion: summary?.promptVersion ?? null,
      })
      .returning({ code: cases.code });
    if (!created) throw new Error("case insert returned no row");
    return { kind: "created", caseCode: created.code, secretCode: formatSecretCode(secret) };
  } catch (error) {
    // Another request for the same analysis got there first.
    if (!isUniqueViolation(error, "cases_analysis_id_unique")) throw error;
    const winner = await existingCase(analysisId, deps.db);
    if (!winner) throw error;
    return { kind: "already_reported", caseCode: winner };
  }
}

async function existingCase(analysisId: string, db: Db): Promise<string | undefined> {
  const [row] = await db
    .select({ code: cases.code })
    .from(cases)
    .where(eq(cases.analysisId, analysisId));
  return row?.code;
}

function prepareNote(raw: string | undefined): string | null {
  const typed = standardizeText(raw ?? "");
  if (typed === "") return null;
  return [...redactNote(typed).text].slice(0, MAX_STORED_NOTE_CHARS).join("");
}

/** Null when there is no summary to store; the case is created either way (contracts A-02). */
async function summarize(
  analysisId: string,
  analysis: { redactedContent: string; verdict: string; riskTypes: string[]; details: unknown },
  req: ReportRequest,
  note: string | null,
  deps: ReportDeps,
) {
  const log = deps.log ?? logEvent;
  const skip = (code: string) => {
    log({ event: "case_summary_failed", code, analysisId });
    return null;
  };
  // Parsed on the way out (DB-02).
  const details = AnalysisDetails.safeParse(analysis.details);
  if (!details.success) return skip("details_invalid");

  const result = await summarizeCase(
    {
      content: analysis.redactedContent,
      verdict: analysis.verdict,
      riskTypes: analysis.riskTypes,
      channel: req.channel,
      signals: details.data.signals.map(({ type, source, evidence }) => ({
        type,
        source,
        evidence,
      })),
      checks: details.data.indicators.flatMap((indicator) => indicator.checks),
      note,
    },
    {
      llm: guardLlm(deps.llm, { reserve: deps.reserveLlmCall, log }),
      model: deps.model,
      now: deps.now,
      random: deps.random,
      ...deps.llmOptions,
    },
    { deadline: deps.now().getTime() + SUMMARY_TIMEOUT_MS },
  );
  if (!result.ok) return skip(result.reason);
  return {
    value: { summary: result.summary, nextSteps: result.nextSteps },
    promptVersion: result.promptVersion,
  };
}
