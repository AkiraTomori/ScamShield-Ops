/**
 * Input rules shared by the client counter and the server (SO-01-AC02, analysis-pipeline §4, U-02).
 * Browser-safe: no Node APIs.
 */

export const MAX_INPUT_CHARS = 2000;

export type InputErrorCode = "empty" | "too_long";

export const INPUT_ERROR_MESSAGE_VI: Record<InputErrorCode, string> = {
  empty: "Hãy dán nội dung tin nhắn cần kiểm tra.",
  too_long: "Nội dung quá dài. Tối đa 2.000 ký tự.",
};

/**
 * Control characters except tab and newline, the zero-width characters used to split domains, and
 * unpaired surrogates (Postgres rejects them).
 */
const STRIPPED = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF\p{Cs}]/gu;

export type NormalizedInput = { ok: true; text: string } | { ok: false; code: InputErrorCode };

/** The standard form of any text a user typed: the message, and the reporter's note. */
export function standardizeText(raw: string): string {
  // NFC again after stripping: removing a zero-width character can let two code points compose.
  return raw.normalize("NFC").replace(STRIPPED, "").normalize("NFC").trim();
}

/** Length as the limit sees it: code points of the standard content. */
export function countInputChars(raw: string): number {
  return [...standardizeText(raw)].length;
}

/** The returned text is the "standard content" every later step works on. */
export function normalizeInput(raw: string): NormalizedInput {
  const text = standardizeText(raw);
  if (text === "") return { ok: false, code: "empty" };
  if ([...text].length > MAX_INPUT_CHARS) return { ok: false, code: "too_long" };
  return { ok: true, text };
}
