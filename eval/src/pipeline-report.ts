import type { PipelineMetrics, PipelineScore, Ratio } from "./pipeline-score";

export interface RunMeta {
  date: string;
  set: "dev";
  commit: string;
  dirty: boolean;
  models: { signals: string; explain: string };
  promptVersion: string;
  rulesVersion: string;
  interrupted: boolean;
}

const percent = (r: Ratio) =>
  r.rate === null ? `— (${r.num}/${r.den})` : `${Math.round(r.rate * 100)}% (${r.num}/${r.den})`;
const seconds = (ms: number | null) =>
  ms === null ? "—" : `${(ms / 1000).toFixed(1).replace(".", ",")} s`;

const commitLabel = (meta: RunMeta) =>
  meta.dirty ? `${meta.commit} (cây làm việc có thay đổi)` : meta.commit;
const modelLabel = ({ signals, explain }: RunMeta["models"]) =>
  signals === explain ? signals : `${signals} + ${explain}`;

/** One line of the run log in research B.4. */
export function formatB4Row(meta: RunMeta, score: PipelineScore): string {
  const m = score.all;
  const notes = [
    `${score.lostVerdictRuns}/${m.runs} lượt mất verdict và ${score.lostExplanationRuns}/${m.runs} lượt mất giải thích vì 429, sự cố hoặc quá giờ`,
    "tra cứu ngoài tắt",
    ...(meta.interrupted ? ["lượt chạy dở dang"] : []),
  ];
  const cells = [
    meta.date,
    meta.set,
    commitLabel(meta),
    modelLabel(meta.models),
    `${meta.promptVersion} / ${meta.rulesVersion}`,
    percent(m.precision),
    percent(m.recall),
    percent(m.falsePositiveRate),
    percent(m.schemaValid),
    percent(m.inconclusiveAmbiguous),
    percent(m.injection),
    `${seconds(m.latencyMs.p50)} / ${seconds(m.latencyMs.p95)}`,
    percent(m.stability),
    notes.join("; "),
  ];
  return `| ${cells.join(" | ")} |`;
}

const ROWS: [string, (m: PipelineMetrics) => string][] = [
  ["Số lượt", (m) => String(m.runs)],
  ["Precision", (m) => percent(m.precision)],
  ["Recall", (m) => percent(m.recall)],
  ["Dương tính giả", (m) => percent(m.falsePositiveRate)],
  ["Đúng schema (mọi lời gọi LLM)", (m) => percent(m.schemaValid)],
  ["`inconclusive` trên nhóm không rõ", (m) => percent(m.inconclusiveAmbiguous)],
  ["Chống injection", (m) => percent(m.injection)],
  ["Ổn định (theo câu)", (m) => percent(m.stability)],
  ["Có giải thích", (m) => percent(m.explanationPresent)],
  ["p50 / p95", (m) => `${seconds(m.latencyMs.p50)} / ${seconds(m.latencyMs.p95)}`],
];

export function formatPipelineSummary(meta: RunMeta, score: PipelineScore): string {
  const failures = Object.entries(score.providerFailures);
  return [
    `# Eval pipeline, tập ${meta.set}, ${meta.date}`,
    "",
    `Commit ${commitLabel(meta)}; model ${modelLabel(meta.models)}; ${meta.promptVersion} / ${meta.rulesVersion}.`,
    "Độ trễ đo `analyzeMessage` trên máy chạy eval, không gồm mạng tới bản deploy và bước lưu DB. Bộ câu nhỏ, tự soạn.",
    "",
    "| Chỉ số | Tính mọi lượt | Không tính lỗi hạ tầng |",
    "|---|---|---|",
    ...ROWS.map(([name, f]) => `| ${name} | ${f(score.all)} | ${f(score.withoutInfraFailures)} |`),
    "",
    `Vì 429, sự cố hoặc quá giờ: ${score.lostVerdictRuns} lượt mất verdict, ${score.lostExplanationRuns} lượt có verdict nhưng mất giải thích. Lời gọi hỏng theo mã: ${
      failures.length === 0 ? "không có" : failures.map(([c, n]) => `${c} × ${n}`).join(", ")
    }.`,
    "",
    "## Dòng cho research B.4",
    "",
    formatB4Row(meta, score),
    "",
    "## Câu có verdict ngoài nhãn",
    "",
    ...(score.wrongCases.length === 0
      ? ["Không có."]
      : [
          "| Câu | Nhãn chấp nhận | Verdict từng lượt |",
          "|---|---|---|",
          ...score.wrongCases.map(
            (w) => `| ${w.id} | ${w.expected.join(", ")} | ${w.got.join(", ")} |`,
          ),
        ]),
    "",
  ].join("\n");
}
