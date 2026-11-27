import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { format, resolveConfig } from "prettier";
import {
  createGroqClient,
  createHttpClient,
  GROQ_ALLOWED_HOSTS,
  PROMPT_VERSION,
  RULES_VERSION,
} from "@scamshield/core";
import { ArgError, parsePipelineArgs } from "./args";
import { sha256 } from "./cache";
import { CaseFileError, parseCaseFile } from "./case";
import { parsePipelineEvalEnv } from "./env";
import { estimateRun } from "./estimate";
import type { PipelineRunRecord } from "./pipeline-record";
import { formatPipelineSummary, type RunMeta } from "./pipeline-report";
import { createEvalPipelineDeps, runKey, runPipeline } from "./pipeline-runner";
import { scorePipeline } from "./pipeline-score";
import { freeResultBase, writeNewFile } from "./result-path";

// `npm run eval -- --set dev` (eval-suite §3). Held-out, the cross-set checks and the hand grading
// sheet belong to T-101/T-103 and are not built here.

const root = resolve(import.meta.dirname, "../..");
const resultsDir = resolve(root, "eval/results");

async function main(): Promise<number> {
  const args = parsePipelineArgs(process.argv.slice(2));
  const casesText = readFileSync(resolve(root, "eval/cases/dev.jsonl"), "utf8");
  const casesSha = sha256(casesText);
  const cases = parseCaseFile(casesText);

  const estimate = estimateRun({ cases, models: 1, runs: args.runs });
  const commit = git(["rev-parse", "--short", "HEAD"]);
  // Local date, as the rest of the docs use it.
  const date = new Date().toLocaleDateString("en-CA");
  const base = freeResultBase(resultsDir, { date, set: "dev", commit }, existsSync);
  console.log(
    [
      `Ước tính: ${estimate.cases} câu × ${estimate.runs} lần × 2 lời gọi = ${estimate.calls} lời gọi (chưa kể thử lại).`,
      `Token vào ~${estimate.inputTokens}; token ra tối đa ${estimate.outputTokensMax}.`,
      `Nghỉ ${args.gapMs} ms giữa các lượt: riêng thời gian nghỉ ~${Math.ceil(((cases.length * args.runs - 1) * args.gapMs) / 60_000)} phút.`,
      `Kết quả sẽ ghi vào: ${base}.json và -summary.md (không ghi đè file có sẵn).`,
    ].join("\n"),
  );
  if (!args.confirm) {
    console.log("\nChưa gọi Groq. Chạy lại với --yes sau khi owner đồng ý.");
    return 0;
  }

  try {
    process.loadEnvFile(resolve(root, ".env"));
  } catch {
    // No .env file: the variables may already be in the environment.
  }
  const env = parsePipelineEvalEnv(process.env);
  if (!env.success) {
    // Names only: issues never echo a value.
    const names = env.error.issues.map((i) => i.path.join("."));
    throw new ArgError(`Missing or invalid variables: ${names.join(", ")}`);
  }
  const models = { signals: env.data.GROQ_MODEL_SIGNALS, explain: env.data.GROQ_MODEL_EXPLAIN };
  const http = createHttpClient({ allowedHosts: GROQ_ALLOWED_HOSTS });
  const deps = createEvalPipelineDeps({
    llm: createGroqClient({ apiKey: env.data.GROQ_API_KEY, http }),
    models,
    reasoningEffort: env.data.GROQ_REASONING_EFFORT,
  });

  const dirty = git(["status", "--porcelain"]) !== "";
  const key = sha256(
    JSON.stringify([
      casesSha,
      commit,
      PROMPT_VERSION,
      RULES_VERSION,
      models,
      env.data.GROQ_REASONING_EFFORT,
      args.runs,
    ]),
  ).slice(0, 16);
  const cache = resolve(root, `eval/.cache/pipeline/dev-${key}.jsonl`);
  const records = readRecords(cache);
  const done = new Set(records.map((r) => runKey(r.caseId, r.run)));
  const total = cases.length * args.runs;
  console.log(`\nChạy ${total - done.size} lượt (đã có ${done.size} lượt trong cache).`);

  mkdirSync(resolve(cache, ".."), { recursive: true });
  await runPipeline(cases, args.runs, deps, {
    gapMs: args.gapMs,
    done,
    onRecord: (record) => {
      appendFileSync(cache, `${JSON.stringify(record)}\n`);
      records.push(record);
      console.log(
        `  ${records.length}/${total} ${record.caseId}#${record.run} ${record.verdict} ${record.providerFailures.join(",")}`,
      );
    },
  });

  const meta: RunMeta = {
    date,
    set: "dev",
    commit,
    dirty,
    models,
    promptVersion: PROMPT_VERSION,
    rulesVersion: RULES_VERSION,
    interrupted: records.length < total,
  };
  const score = scorePipeline(records, cases);
  await writeFormatted(
    `${base}.json`,
    "json",
    JSON.stringify(
      {
        kind: "pipeline",
        ...meta,
        casesSha256: casesSha,
        cases: cases.length,
        runsPerCase: args.runs,
        gapMs: args.gapMs,
        reasoningEffort: env.data.GROQ_REASONING_EFFORT,
        lookups: "off",
        score,
        records,
      },
      null,
      2,
    ),
  );
  const summary = formatPipelineSummary(meta, score);
  await writeFormatted(`${base}-summary.md`, "markdown", summary);
  console.log(`\n${summary}\nKết quả: ${base}.json`);
  return 0;
}

function readRecords(path: string): PipelineRunRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as PipelineRunRecord);
}

/** Formatted with the repo's Prettier config so `npm run verify` stays green once committed. */
async function writeFormatted(path: string, parser: "json" | "markdown", text: string) {
  mkdirSync(resultsDir, { recursive: true });
  const config = (await resolveConfig(path)) ?? {};
  writeNewFile(path, await format(text, { ...config, parser }));
}

function git(args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    // Our own messages never contain the key; anything else prints only its message.
    if (error instanceof ArgError || error instanceof CaseFileError || error instanceof Error) {
      console.error(`Lỗi: ${error.message}`);
    } else {
      console.error("Lỗi không rõ.");
    }
    process.exit(1);
  },
);
