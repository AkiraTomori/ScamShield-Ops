import type { z } from "zod";

/**
 * Parses a model's text as JSON for a given schema. Tolerates the two wrappers models add even in
 * JSON mode (a ```json fence, a leaked <think> block); anything else counts as invalid output.
 */
export function parseModelJson<T extends z.ZodType>(
  text: string,
  schema: T,
): z.infer<T> | undefined {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    return undefined;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** NFC + lowercase + collapsed whitespace: how evidence and filter checks compare text. */
export function normalizeText(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}
