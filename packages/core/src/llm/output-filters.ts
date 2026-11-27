import { fold } from "../text/fold";
import { normalizeText } from "./json";

/**
 * Filters shared by the text a model writes for people: the explanation (analysis-pipeline §9) and
 * the case summary (report-flow §3.2).
 */
export type TextRejection =
  "too_long" | "contains_safe_word" | "contains_percent" | "contains_certainty" | "unknown_number";

/** P1 rules of the case summary only (RP-04). */
export type CaseSummaryRejection = TextRejection | "labels_person" | "forbidden_action";

/** Guarantee language the prompts forbid; the filter enforces the same list (normalized text). */
const CERTAINTY_WORDS = ["chắc chắn", "đảm bảo", "bảo đảm", "tuyệt đối"];

/**
 * Why a model text must be dropped, or undefined. `sentData` is everything the model saw: a digit
 * run that is not in it was invented.
 */
export function rejectModelText(
  text: string,
  sentData: string,
  maxChars: number,
): TextRejection | undefined {
  if (text.length > maxChars) return "too_long";
  const normalized = normalizeText(text);
  if (normalized.includes("an toàn")) return "contains_safe_word";
  if (text.includes("%")) return "contains_percent";
  if (CERTAINTY_WORDS.some((word) => normalized.includes(word))) return "contains_certainty";
  const known = new Set(sentData.match(/\d+/g) ?? []);
  for (const run of text.match(/\d+/g) ?? []) {
    if (!known.has(run)) return "unknown_number";
  }
  return undefined;
}

// Matched without diacritics: "khoá" and "khóa", "toả" and "tỏa" are different strings.
const PERSON_LABEL = /ke lua dao/;
/** Actions the system never takes (SO-06-AC06); a few words may sit between verb and object. */
const FORBIDDEN_ACTIONS = [
  /khoa(?: \S+){0,3}? tai khoan/,
  /chan(?: \S+){0,3}? giao dich/,
  /phong toa/,
];

const plain = (text: string) => fold(normalizeText(text)).text;

/** Nobody is called a scammer, in the summary or in a step (P1). */
export function labelsPerson(text: string): boolean {
  return PERSON_LABEL.test(plain(text));
}

export function proposesForbiddenAction(step: string): boolean {
  const folded = plain(step);
  return FORBIDDEN_ACTIONS.some((pattern) => pattern.test(folded));
}
