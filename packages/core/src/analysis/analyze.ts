import {
  AnalysisResult,
  normalizeInput,
  type BrandList,
  type Indicator,
  type Signal,
  type UrlLists,
} from "@scamshield/shared";
import { extractIndicators, type ExtractedIndicators } from "../indicators";
import {
  EXPLAIN_PROMPT_VERSION,
  extractSignals,
  GroqConfigError,
  SIGNALS_PROMPT_VERSION,
  writeExplanation,
  type ExplanationInput,
  type LlmClient,
  type LlmDeps,
} from "../llm";
import { logEvent, type LogFields } from "../log";
import { redact } from "../redaction";
import { checkDomain, checkUrl, detectInjection, type CheckResult } from "../url-checks";
import { decide, recommend, RULES_VERSION, type DecisionInput, type LlmFailure } from "../verdict";

/** Time budget of analysis-pipeline §2. */
export const INTERNAL_DEADLINE_MS = 17_000;
const SIGNAL_ATTEMPT_MS = [8_000, 6_000];
const LOOKUP_TIMEOUT_MS = 3_000;
const EXPLAIN_TIMEOUT_MS = 4_000;
const EXPLAIN_MIN_REMAINING_MS = 3_000;

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
  const checked = runChecks(extracted, deps);
  const injection = detectInjection(text);
  const prepared = clock();

  let llmCalls = 0;
  const llm: LlmClient = {
    async chatJson(request) {
      if (deps.reserveLlmCall && !(await deps.reserveLlmCall())) {
        return { ok: false, kind: "unavailable", latencyMs: 0 };
      }
      llmCalls += 1;
      let reply;
      try {
        reply = await deps.llm.chatJson(request);
      } catch (error) {
        // 401 is a bad key, 404 a wrong model name. The status only: never the message.
        if (error instanceof GroqConfigError) {
          log({ event: "llm_call_failed", code: `config_${error.status}` });
        }
        throw error;
      }
      // The HTTP status tells a rate limit apart from an outage; never any content.
      if (!reply.ok) {
        log({ event: "llm_call_failed", code: `${reply.kind}_${reply.status ?? "no_status"}` });
      }
      return reply;
    },
  };
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
function runChecks(
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
