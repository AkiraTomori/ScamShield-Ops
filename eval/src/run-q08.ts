import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { format, resolveConfig } from "prettier";
import {
  createGroqClient,
  createHttpClient,
  EXPLAIN_PROMPT_VERSION,
  GROQ_ALLOWED_HOSTS,
  SIGNALS_PROMPT_VERSION,
} from "@scamshield/core";
import { ArgError, parseQ08Args, pricesFor } from "./args";
import {
  appendRecord,
  cachePath,
  clearCache,
  gradingSheetPath,
  dropInfraFailures,
  isInfraFailure,
  readCache,
  sha256,
} from "./cache";
import { CaseFileError, parseCaseFile } from "./case";
import { parseEvalEnv } from "./env";
import { estimateRun } from "./estimate";
import { formatGradingSheet, formatSummary, hasGradedScores } from "./report";
import type { RunRecord } from "./record";
import { buildTasks, runAll, taskKey, type ModelOptions } from "./runner";
import { scoreModel, THRESHOLDS } from "./score";

const root = resolve(import.meta.dirname, "../..");
const cacheDir = resolve(root, "eval/.cache/q08");
const resultsDir = resolve(root, "eval/results");

async function main(): Promise<number> {
  const args = parseQ08Args(process.argv.slice(2));

  try {
    process.loadEnvFile(resolve(root, ".env"));
  } catch {
    // No .env file: the variable may already be in the environment.
  }

  if (args.listModels) {
    const groq = createGroq();
    const models = await groq.listModels();
    console.log("id\towned_by\tactive\tcontext_window");
    for (const m of [...models].sort((a, b) => a.id.localeCompare(b.id))) {
      console.log(`${m.id}\t${m.owned_by ?? ""}\t${m.active ?? ""}\t${m.context_window ?? ""}`);
    }
    return 0;
  }

  if (args.models.length === 0) throw new ArgError("--models is required (see --list-models)");

  const casesText = readFileSync(resolve(root, args.casesPath), "utf8");
  const casesSha = sha256(casesText);
  let cases = parseCaseFile(casesText);
  if (args.limit !== null) cases = cases.slice(0, args.limit);

  const estimate = estimateRun({
    cases,
    models: args.models.length,
    runs: args.runs,
    prices: pricesFor(args),
  });
  console.log(
    [
      `Ước tính: ${estimate.models} model × ${estimate.cases} câu × ${estimate.runs} lần × 2 lời gọi = ${estimate.calls} lời gọi.`,
      `Token vào ~${estimate.inputTokens} (ước lượng ~3 ký tự/token); token ra tối đa ${estimate.outputTokensMax}.`,
      estimate.cost
        ? `Chi phí theo giá đã nhập: từ ${estimate.cost.min.toFixed(4)} (chỉ token vào) đến ${estimate.cost.max.toFixed(4)} (mọi lời gọi dùng hết max_tokens).`
        : "Chưa nhập giá (--price-in, --price-out cho mỗi 1M token), nên chưa có chi phí.",
    ].join("\n"),
  );
  if (!args.confirm) {
    console.log("\nChưa gọi Groq. Báo ước tính cho owner, rồi chạy lại với --confirm.");
    return 0;
  }

  const groq = createGroq();
  const promptTag = `${SIGNALS_PROMPT_VERSION}-${EXPLAIN_PROMPT_VERSION}`;
  const paths = new Map(args.models.map((m) => [m, cachePath(cacheDir, m, casesSha, promptTag)]));

  const done = new Set<string>();
  for (const [model, path] of paths) {
    if (args.fresh) clearCache(path);
    if (args.retryFailed) {
      const dropped = dropInfraFailures(path);
      console.log(`${model}: bỏ ${dropped} lượt lỗi hạ tầng khỏi cache để chạy lại.`);
    }
    const existing = readCache(path);
    if (existing.length > 0 && !args.resume) {
      throw new ArgError(
        `Cache exists for ${model}; pass --resume to continue or --fresh to start over.`,
      );
    }
    for (const r of existing) done.add(taskKey(r));
  }

  // Reuse signals from an earlier prompt-tag cache (only the explanation prompt changed).
  const reuseRecords = new Map<string, RunRecord>();
  if (args.reuseSignalsFrom) {
    for (const model of args.models) {
      const old = cachePath(cacheDir, model, casesSha, args.reuseSignalsFrom);
      const records = readCache(old);
      if (records.length === 0) throw new ArgError(`No cache to reuse for ${model} (${old}).`);
      for (const r of records)
        if (!isInfraFailure(r) || r.signals.ok) reuseRecords.set(taskKey(r), r);
    }
    console.log(`Dùng lại signal từ ${reuseRecords.size} lượt của cache ${args.reuseSignalsFrom}.`);
  }

  const modelOptions: Record<string, ModelOptions> = {};
  for (const model of args.models) {
    modelOptions[model] = {
      jsonMode: args.noJsonMode.includes(model) ? false : undefined,
      reasoningFormat: args.reasoningFormat as "hidden" | "parsed" | undefined,
      reasoningEffort: args.reasoningEffort,
    };
  }

  let stopping = false;
  process.once("SIGINT", () => {
    stopping = true;
    console.log("\nĐang dừng sau các lời gọi đang chạy; phần đã xong còn trong eval/.cache/.");
  });

  const tasks = buildTasks(args.models, cases, args.runs, done);
  console.log(`\nChạy ${tasks.length} lượt (đã có ${done.size} lượt trong cache).`);
  let finished = 0;
  await runAll(
    tasks,
    {
      llm: groq,
      now: () => new Date(),
      random: () => randomUUID().replace(/-/g, "").slice(0, 8),
      modelOptions,
      reuse: (task) =>
        reuseRecords.get(taskKey({ model: task.model, caseId: task.case.id, run: task.run })),
    },
    {
      concurrency: args.concurrency,
      shouldStop: () => stopping,
      onRecord: (record) => {
        appendRecord(paths.get(record.model) as string, record);
        finished += 1;
        if (finished % 10 === 0) console.log(`  ${finished}/${tasks.length}`);
      },
    },
  );

  const all = [...paths.values()].flatMap((p) => readCache(p));
  const prices = pricesFor(args);
  const scores = args.models.map((model, i) => scoreModel(model, cases, all, prices?.[i]));
  console.log(`\n${formatSummary(scores)}`);

  const date = new Date().toISOString().slice(0, 10);
  const commit = git(["rev-parse", "--short", "HEAD"]);
  const dirty = git(["status", "--porcelain"]) !== "";
  mkdirSync(resultsDir, { recursive: true });
  const resultFile = resolve(resultsDir, `q08-${date}-${commit}-${promptTag}.json`);
  const resultJson = JSON.stringify(
    {
      kind: "q08",
      date,
      commit,
      dirty,
      casesFile: args.casesPath,
      casesSha256: casesSha,
      cases: cases.length,
      runs: args.runs,
      interrupted: stopping,
      promptVersions: { signals: SIGNALS_PROMPT_VERSION, explain: EXPLAIN_PROMPT_VERSION },
      parameters: {
        temperature: 0,
        concurrency: args.concurrency,
        jsonModeOff: args.noJsonMode,
        reasoningFormat: args.reasoningFormat ?? null,
        reasoningEffort: args.reasoningEffort ?? null,
        priceInPerMillion: args.priceIn,
        priceOutPerMillion: args.priceOut,
      },
      thresholds: THRESHOLDS,
      models: scores,
    },
    null,
    2,
  );
  // Format with the repo's Prettier config so `npm run verify` stays green once this is committed.
  const prettierConfig = (await resolveConfig(resultFile)) ?? {};
  writeFileSync(resultFile, await format(resultJson, { ...prettierConfig, parser: "json" }));
  console.log(`\nKết quả: ${resultFile}`);

  for (const model of args.models) {
    const sheet = gradingSheetPath(cacheDir, model, casesSha, promptTag);
    // Never overwrite scores typed by hand; delete the file to regenerate it on purpose.
    if (existsSync(sheet) && hasGradedScores(readFileSync(sheet, "utf8"))) {
      console.log(`Bảng chấm đã có điểm, giữ nguyên (xoá file nếu muốn tạo lại): ${sheet}`);
      continue;
    }
    writeFileSync(sheet, formatGradingSheet(model, cases, all));
    console.log(`Bảng chấm tiếng Việt: ${sheet}`);
  }
  return 0;
}

function createGroq() {
  const env = parseEvalEnv(process.env);
  if (!env.success) throw new ArgError(env.error.issues.map((i) => i.message).join("; "));
  const http = createHttpClient({ allowedHosts: GROQ_ALLOWED_HOSTS });
  return createGroqClient({ apiKey: env.data.GROQ_API_KEY, http });
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
    // Messages from our own errors never contain the key; anything else prints only its name.
    if (error instanceof ArgError || error instanceof CaseFileError || error instanceof Error) {
      console.error(`Lỗi: ${error.message}`);
    } else {
      console.error("Lỗi không rõ.");
    }
    process.exit(1);
  },
);
