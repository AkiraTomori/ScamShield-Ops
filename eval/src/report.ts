import type { EvalCase } from "./case";
import type { RunRecord } from "./record";
import type { ModelScore } from "./score";

const pct = (v: number | null, digits = 1) =>
  v === null ? "n/a" : `${(v * 100).toFixed(digits)}%`;
const num = (v: number | null) => (v === null ? "n/a" : String(v));
const mark = (v: boolean | null) => (v === null ? "?" : v ? "đạt" : "TRƯỢT");

/** Plain-text table to paste into research A.6. One block per model. */
export function formatSummary(scores: readonly ModelScore[]): string {
  return scores
    .map((s) => {
      const lines = [
        `Model: ${s.model}  (${s.cases} câu, ${s.calls} lượt)`,
        `  Đúng schema        ${s.schema.ok}/${s.calls} (${pct(s.schema.okRate)}); đúng ngay lần đầu ${s.schema.okFirstTry}/${s.calls}; chỉ tính JSON hỏng ${pct(s.schema.parseOnlyRate)}  [${mark(s.passes.schema)}]`,
        `    lỗi: invalid=${s.schema.failures.llm_invalid_output} unavailable=${s.schema.failures.llm_unavailable} timeout=${s.schema.failures.timeout}; 429 đã chờ=${s.rateLimited}`,
        `    cắt cụt do max_tokens (finishReason=length): signal ${s.truncated.signalsCalls}, giải thích ${s.truncated.explainCalls} lời gọi; ${s.truncated.recordsAffected}/${s.calls} lượt bị ảnh hưởng`,
        `  Recall signal      ${s.recall.found}/${s.recall.expected} (${pct(s.recall.rate)})`,
        `  Bịa evidence       ${s.fabricated.dropped}/${s.fabricated.returned} (${pct(s.fabricated.rate)})  [${mark(s.passes.fabricatedUnderWorryLevel)}]`,
        `  Bắt nhầm (legit)   ${s.falsePositives.signals} signal; ${s.falsePositives.callsAffected}/${s.falsePositives.calls} lượt`,
        `  Chống injection    ${s.injection.casesPassed}/${s.injection.cases} câu (${s.injection.callsPassed}/${s.injection.calls} lượt)  [${mark(s.passes.injection)}]`,
        `  Ổn định            ${pct(s.stability)}  [${mark(s.passes.stability)}]`,
        `  Độ trễ p50 / p95   ${num(s.latencyMs.p50)} / ${num(s.latencyMs.p95)} ms  [${mark(s.passes.p95)}]`,
        `  Token vào/ra       signals ${s.tokens.signalsIn}/${s.tokens.signalsOut}; giải thích ${s.tokens.explainIn}/${s.tokens.explainOut}`,
        `  Giải thích null    ${s.explanations.total - s.explanations.ok}/${s.explanations.total} (${pct(s.explanations.nullRate)}) ${JSON.stringify(s.explanations.rejected)}`,
        `  Chi phí            ${s.cost ? `${s.cost.total.toFixed(4)} tổng; ${s.cost.per1000Analyses.toFixed(4)} / 1.000 lượt` : "chưa nhập giá"}`,
      ];
      return lines.join("\n");
    })
    .join("\n\n");
}

/** True when someone has already filled in at least one score (a line other than `- Điểm: _`). */
export function hasGradedScores(sheet: string): boolean {
  return /^- Điểm: (?!\\?_\s*$)\S/m.test(sheet);
}

/** Markdown sheet for hand-grading Vietnamese quality (scale 1-3), run 1 of every case. */
export function formatGradingSheet(
  model: string,
  cases: readonly EvalCase[],
  records: readonly RunRecord[],
): string {
  const out = [
    `# Chấm tiếng Việt: ${model}`,
    "",
    "Thang: 1 = sai/khó hiểu, 2 = đúng nhưng vụng, 3 = tự nhiên. Ghi thêm nếu giải thích nêu sự kiện ngoài signal (SO-03-AC05).",
    "",
  ];
  for (const c of cases) {
    const r = records.find((x) => x.model === model && x.caseId === c.id && x.run === 1);
    if (!r) continue;
    const text = r.explanation.ok
      ? r.explanation.explanation
      : `(không có: ${r.explanation.reason})`;
    out.push(
      `## ${c.id} (${c.group})`,
      `- Đầu vào giải thích: verdict \`${c.expectedVerdicts[0]}\`, signal \`${c.expectedSignals.join(", ") || "-"}\``,
      `- Giải thích: ${text}`,
      "- Điểm: _",
      "",
    );
  }
  return out.join("\n");
}
