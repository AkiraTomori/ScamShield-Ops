import { AnalysisEnv } from "@scamshield/shared";
import { z } from "zod";

/** The runner's own env schema: unlike the app, it cannot do anything without the key. */
export const EvalEnv = z.object({
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required (set it in .env)"),
});
export type EvalEnv = z.infer<typeof EvalEnv>;

export function parseEvalEnv(source: Record<string, string | undefined>) {
  return EvalEnv.safeParse(source);
}

/** `npm run eval` reads the model settings by the same rules as the deployed pipeline. */
export const PipelineEvalEnv = AnalysisEnv.pick({
  GROQ_API_KEY: true,
  GROQ_MODEL_SIGNALS: true,
  GROQ_MODEL_EXPLAIN: true,
  GROQ_REASONING_EFFORT: true,
});

export function parsePipelineEvalEnv(source: Record<string, string | undefined>) {
  return PipelineEvalEnv.safeParse(source);
}
