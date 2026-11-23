import { SignalType, Verdict } from "@scamshield/shared";
import { z } from "zod";

export const CaseGroup = z.enum(["clear_scam", "legit_lookalike", "ambiguous", "prompt_injection"]);
export type CaseGroup = z.infer<typeof CaseGroup>;

/** One hand-labelled situation (research B.2). Labels are human decisions, never model output. */
export const EvalCase = z
  .object({
    id: z.string().regex(/^[a-z]+-\d{3}$/, "id looks like dev-001"),
    group: CaseGroup,
    content: z.string().min(1).max(2000),
    expectedVerdicts: z.array(Verdict).min(1),
    expectedSignals: z.array(SignalType),
    forbiddenSignals: z.array(SignalType),
    notes: z.string(),
  })
  .strict()
  .refine((c) => !c.expectedSignals.some((s) => c.forbiddenSignals.includes(s)), {
    message: "a signal cannot be both expected and forbidden",
  });
export type EvalCase = z.infer<typeof EvalCase>;

export class CaseFileError extends Error {}

/** Parses a JSONL file. Any bad line stops the run (research B.2: "file sai thì runner dừng"). */
export function parseCaseFile(text: string): EvalCase[] {
  const cases: EvalCase[] = [];
  const ids = new Set<string>();
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.trim() === "") return;
    const where = `line ${index + 1}`;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      throw new CaseFileError(`${where}: not valid JSON`);
    }
    const parsed = EvalCase.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new CaseFileError(
        `${where}: ${issue?.path.join(".") ?? ""} ${issue?.message ?? "invalid"}`.trim(),
      );
    }
    if (ids.has(parsed.data.id))
      throw new CaseFileError(`${where}: duplicate id ${parsed.data.id}`);
    ids.add(parsed.data.id);
    cases.push(parsed.data);
  });
  return cases;
}
