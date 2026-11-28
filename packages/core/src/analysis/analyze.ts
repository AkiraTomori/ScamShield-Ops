import {
  AnalysisResult,
  EVIDENCE_MAX_CHARS,
  MatchableIndicatorType,
  normalizeInput,
  type BrandList,
  type Check,
  type Indicator,
  type Signal,
  type UrlLists,
} from "@scamshield/shared";
import type { MatchableIndicator } from "../confirmed-indicators/select";
import { extractIndicators, type ExtractedIndicators } from "../indicators";
import {
  EXPLAIN_PROMPT_VERSION,
  extractSignals,
  guardLlm,
  SIGNALS_PROMPT_VERSION,
  writeExplanation,
  type ExplanationInput,
  type LlmClient,
  type LlmDeps,
} from "../llm";
import { logEvent, type LogFields } from "../log";
import { redact } from "../redaction";
import { clip } from "../text/clip";
import { checkDomain, checkUrl, detectInjection, type CheckResult } from "../url-checks";
import { decide, recommend, RULES_VERSION, type DecisionInput, type LlmFailure } from "../verdict";

/** Time budget of analysis-pipeline §2. */
export const INTERNAL_DEADLINE_MS = 17_000;
const SIGNAL_ATTEMPT_MS = [8_000, 6_000];
const LOOKUP_TIMEOUT_MS = 3_000;
const EXPLAIN_TIMEOUT_MS = 4_000;
const EXPLAIN_MIN_REMAINING_MS = 3_000;
/** The same second the rate limit gets (verified-indicators §3). */
export const VERIFIED_LOOKUP_TIMEOUT_MS = 1_000;

export const PROMPT_VERSION = `${SIGNALS_PROMPT_VERSION}+${EXPLAIN_PROMPT_VERSION}`;

export interface AnalysisDeps {
  llm: LlmClient;
  models: { signals: string; explain: string };
  llmOptions?: Pick<LlmDeps, "jsonMode" | "reasoningFormat" | "reasoningEffort">;
  brands: BrandList;
  urlLists: UrlLists;
  now: () => Date;
  random: () => string;
  newId: () => string;
  /**
   * Which of these indicators are on the confirmed list (SO-08-AC02). Required, so that no caller
   * can leave the list out by accident; eval passes one that always finds nothing.
   */
  verifiedIndicators: (keys: MatchableIndicator[]) => Promise<MatchableIndicator[]>;
  /** External lookups (SO-02-AC03). Must report failures as `unavailable`. Unset: no check. */
  lookupDomain?: (domain: string, signal: AbortSignal) => Promise<CheckResult>;
  /** P-03: reserves one model call against the daily cap. Unset: no cap. */
  reserveLlmCall?: () => Promise<boolean>;
  log?: (fields: LogFields) => void;
}

/** For eval and operations; never returned by the API. */
export interface AnalysisTrace {
  steps: { prepareMs: number; modelAndLookupMs: number; explainMs: number; totalMs: number };
  llmCalls: number;
  signalAttempts: number;
  droppedSignals: number;
  signalsFailure: LlmFailure | null;
  explanationFailure: string | null;
}

/** What the caller stores next to the result. Holds the redacted content only. */
export interface AnalysisRecord {
  redactedContent: string;
  modelSignals: string | null;
  modelExplain: string | null;
}

export interface AnalysisOutcome {
  result: AnalysisResult;
  trace: AnalysisTrace;
  record: AnalysisRecord;
}

export interface AnalyzeOptions {
  /** When the request arrived (`T0`); defaults to now. */
  startedAt?: number;
  deadlineMs?: number;
}

/**
 * The whole pipeline for one message (SO-01…SO-03). The API route and the eval runner call this
 * same function; it does not store anything (EV-02).
 */
export async function analyzeMessage(
  content: string,
  deps: AnalysisDeps,
  opts: AnalyzeOptions = {},
): Promise<AnalysisOutcome> {
  const clock = () => deps.now().getTime();
  const log = deps.log ?? logEvent;
  const started = opts.startedAt ?? clock();
  const deadline = started + (opts.deadlineMs ?? INTERNAL_DEADLINE_MS);

  const input = normalizeInput(content);
  if (!input.ok) throw new Error(`analyzeMessage got invalid input: ${input.code}`);

  // From here on only the redacted text exists for storage, logs and the model.
  const { text, counts } = redact(input.text);
  const extracted = extractIndicators(text, deps.brands);
  const ruled = runChecks(extracted, deps);
  const injection = detectInjection(text);
  // Before the model: a list that cannot be read fails the request without spending a call.
  const checked = await applyConfirmedList(ruled, deps, log);
  const prepared = clock();

  let llmCalls = 0;
  const llm = guardLlm(deps.llm, {
    reserve: deps.reserveLlmCall,
    log,
    onCall: () => {
      llmCalls += 1;
    },
  });
  const llmDeps = (model: string): LlmDeps => ({
    llm,
    model,
    now: deps.now,
    random: deps.random,
    ...deps.llmOptions,
  });

  const [extraction, lookups] = await Promise.all([
    extractSignals(text, llmDeps(deps.models.signals), {
      deadline,
      attemptTimeoutMs: SIGNAL_ATTEMPT_MS,
    }),
    runLookups(extracted, deps, Math.max(0, deadline - clock())),
  ]);
  const signalCalls = llmCalls;
  const looked = clock();

  const indicators: Indicator[] = checked.indicators.map((indicator) => {
    const found = indicator.type === "domain" ? lookups.get(indicator.normalized) : undefined;
    return found ? { ...indicator, checks: [...indicator.checks, ...found.checks] } : indicator;
  });
  const deterministic: Signal[] = [
    ...checked.signals,
    ...[...lookups.values()].flatMap((r) => r.signals),
    ...injection,
  ];
  const fromModel: Signal[] = extraction.ok
    ? extraction.signals
        // The deterministic injection finding wins over the model's report of the same thing.
        .filter((s) => !(s.type === "ai_directed_instruction" && injection.length > 0))
        .map((s) => ({ type: s.type, source: "ai", evidence: s.evidence, indicator: null }))
    : [];
  const signals = [...deterministic, ...fromModel];

  const decisionInput: DecisionInput = {
    signals,
    indicators,
    llmFailure: extraction.ok ? null : extraction.reason,
    textLength: [...input.text].length,
    brands: deps.brands,
  };
  const decision = decide(decisionInput);

  let explanation: string | null = null;
  let explanationFailure: string | null = null;
  let explained = false;
  if (!extraction.ok) {
    explanationFailure = "skipped_no_signals";
  } else if (deadline - clock() < EXPLAIN_MIN_REMAINING_MS) {
    explanationFailure = "skipped_no_time";
  } else {
    const explainInput: ExplanationInput = {
      verdict: decision.verdict,
      rule: decision.rule,
      signals: signals.map(({ type, source, evidence }) => ({ type, source, evidence })),
      checks: indicators.flatMap((i) => i.checks),
    };
    try {
      const written = await writeExplanation(explainInput, llmDeps(deps.models.explain), {
        deadline: Math.min(clock() + EXPLAIN_TIMEOUT_MS, deadline),
      });
      explained = llmCalls > signalCalls;
      if (written.ok) explanation = written.explanation;
      else explanationFailure = written.reason;
    } catch {
      // The verdict is already decided: a broken explanation model must not fail the analysis.
      log({ event: "explanation_failed", code: "config_or_internal" });
      explanationFailure = "error";
      explained = llmCalls > signalCalls;
    }
  }
  const finished = clock();

  const result = AnalysisResult.parse({
    analysisId: deps.newId(),
    verdict: decision.verdict,
    inconclusiveReason: decision.inconclusiveReason,
    riskTypes: decision.riskTypes,
    signals,
    indicators,
    redactions: counts,
    explanation,
    recommendations: recommend(decisionInput, decision),
    rule: decision.rule,
    promptVersion: PROMPT_VERSION,
    rulesVersion: RULES_VERSION,
    createdAt: new Date(started).toISOString(),
  });

  return {
    result,
    trace: {
      steps: {
        prepareMs: prepared - started,
        modelAndLookupMs: looked - prepared,
        explainMs: finished - looked,
        totalMs: finished - started,
      },
      llmCalls,
      signalAttempts: extraction.attempts,
      droppedSignals: extraction.ok ? extraction.droppedSignals : 0,
      signalsFailure: extraction.ok ? null : extraction.reason,
      explanationFailure,
    },
    record: {
      redactedContent: text,
      modelSignals: signalCalls > 0 ? deps.models.signals : null,
      modelExplain: explained ? deps.models.explain : null,
    },
  };
}

/** Deterministic checks for every url and domain indicator (SO-02-AC02). */
export function runChecks(
  extracted: ExtractedIndicators,
  deps: Pick<AnalysisDeps, "brands" | "urlLists">,
): { indicators: Indicator[]; signals: Signal[] } {
  const signals: Signal[] = [];
  const indicators = extracted.indicators.map((indicator) => {
    let found: CheckResult | undefined;
    if (indicator.type === "url") {
      const url = extracted.urls.find((u) => u.normalized === indicator.normalized);
      if (url) found = checkUrl(url, indicator.value);
    } else if (indicator.type === "domain") {
      found = checkDomain(indicator.normalized, {
        urls: extracted.urls.filter((u) => u.domain === indicator.normalized),
        value: indicator.value,
        mentionedBrandIds: extracted.brandIds,
        brands: deps.brands,
        urlLists: deps.urlLists,
      });
    }
    if (!found) return indicator;
    signals.push(...found.signals);
    return { ...indicator, checks: found.checks };
  });
  return { indicators, signals };
}

const VERIFIED_CHECK: Check = { type: "verified_indicator", status: "warn", detail: null };

/**
 * SO-08-AC02: an indicator on the confirmed list gets a check and a hard signal (R1). One that is not
 * on it gets nothing: "not listed" is not a passed check. A list that cannot be read fails the
 * analysis rather than passing for "no match" (verified-indicators §3).
 */
async function applyConfirmedList(
  checked: { indicators: Indicator[]; signals: Signal[] },
  deps: Pick<AnalysisDeps, "verifiedIndicators">,
  log: (fields: LogFields) => void,
): Promise<{ indicators: Indicator[]; signals: Signal[] }> {
  const keys = checked.indicators.flatMap(({ type, normalized }) => {
    const matchable = MatchableIndicatorType.safeParse(type);
    return matchable.success ? [{ type: matchable.data, normalized }] : [];
  });
  if (keys.length === 0) return checked;

  let matches: MatchableIndicator[];
  try {
    matches = await withTimeout(deps.verifiedIndicators(keys), VERIFIED_LOOKUP_TIMEOUT_MS);
  } catch {
    log({ event: "verified_lookup_failed" });
    // Not the original: a driver error carries the query's values.
    throw new Error("verified_lookup_failed");
  }

  const listed = new Set(matches.map((m) => `${m.type} ${m.normalized}`));
  const signals: Signal[] = [];
  const indicators = checked.indicators.map((indicator) => {
    if (!listed.has(`${indicator.type} ${indicator.normalized}`)) return indicator;
    signals.push({
      type: "verified_indicator",
      source: "deterministic",
      evidence: clip(indicator.value, EVIDENCE_MAX_CHARS),
      indicator: indicator.normalized,
    });
    return { ...indicator, checks: [...indicator.checks, VERIFIED_CHECK] };
  });
  // First: it is the strongest thing the result has to say.
  return { indicators, signals: [...signals, ...checked.signals] };
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function runLookups(
  extracted: ExtractedIndicators,
  deps: Pick<AnalysisDeps, "lookupDomain" | "log">,
  remainingMs: number,
): Promise<Map<string, CheckResult>> {
  const results = new Map<string, CheckResult>();
  const lookup = deps.lookupDomain;
  if (!lookup) return results;
  const domains = extracted.indicators.filter((i) => i.type === "domain").map((i) => i.normalized);
  await Promise.all(
    domains.map(async (domain) => {
      const signal = AbortSignal.timeout(Math.min(LOOKUP_TIMEOUT_MS, remainingMs));
      try {
        results.set(domain, await lookup(domain, signal));
      } catch {
        (deps.log ?? logEvent)({ event: "lookup_failed" });
      }
    }),
  );
  return results;
}
