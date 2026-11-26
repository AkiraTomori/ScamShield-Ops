import { fold, overlaps, type Span } from "../text/fold";
import { findUrls } from "./urls";

/** Vietnamese phone numbers and receiving account numbers (analysis-pipeline §6.2, §6.3). */

export interface FoundNumber extends Span {
  value: string;
  normalized: string;
}

const SEP = "[ .\\-]?";
const PREFIX = "(?:\\+84|84|0)";
const PHONE_PATTERNS = [
  `${PREFIX}${SEP}[35789](?:${SEP}\\d){8}`, // mobile
  `${PREFIX}${SEP}2(?:${SEP}\\d){9}`, // landline 02x
  `1[89]00(?:${SEP}\\d){4,6}`, // 1800 / 1900 hotlines
];
const PHONE = new RegExp(
  `(?<![\\p{L}\\p{N}_/+])(?<!\\d[.\\-])(?:${PHONE_PATTERNS.join("|")})(?![.\\-]?\\d)(?!\\p{L})`,
  "gu",
);

export function findPhones(content: string, ignore: readonly Span[] = []): FoundNumber[] {
  const found: FoundNumber[] = [];
  for (const match of content.matchAll(PHONE)) {
    const span = { start: match.index, end: match.index + match[0].length };
    if (overlaps(span, ignore)) continue;
    const digits = match[0].replace(/\D/g, "");
    let normalized: string;
    if (/^1[89]00/.test(digits)) normalized = digits;
    else if (digits.startsWith("84")) normalized = `+${digits}`;
    else normalized = `+84${digits.slice(1)}`;
    found.push({ ...span, value: match[0], normalized });
  }
  return found;
}

/** The captured alternatives name a receiving account outright; the rest only mention an account. */
const ACCOUNT_KEYWORD =
  /(?<![a-z0-9])(?:(stk|so tai khoan|so tk|chuyen (?:khoan|tien) (?:vao|toi|den))|tai khoan|tk|account|acc)(?![a-z0-9])/g;
/** Nothing but a separator between a keyword and its number. */
const ADJACENT = /^\s*(?:(?::|=|la(?![a-z]))\s*)?$/;
/** Words allowed between the keyword and the number: no digits, no sentence break. */
const ACCOUNT_NUMBER = /^[^\d\n.!?;]{0,30}?(\d+(?:[ .-]\d+)*)/;
const AMOUNT_GROUPS = /^\d{1,3}(?:[.,]\d{3})+(?!\d)/;
export const CURRENCY_AFTER = /^\s?(?:₫|(?:d|dong|vnd|k|tr|trieu|ty|usd)(?![a-z0-9]))/;

export interface FoundAccount extends FoundNumber {
  /** Introduced by STK, "số tài khoản" or "chuyển tiền vào" rather than a bare "tài khoản". */
  strong: boolean;
  /** Written directly after such a keyword. */
  adjacent: boolean;
}

export function findAccounts(content: string): FoundAccount[] {
  const folded = fold(content);
  const found: FoundAccount[] = [];
  for (const keyword of folded.text.matchAll(ACCOUNT_KEYWORD)) {
    const after = keyword.index + keyword[0].length;
    const match = ACCOUNT_NUMBER.exec(folded.text.slice(after));
    const group = match?.[1];
    if (!match || !group) continue;
    const from = after + match[0].length - group.length;
    // A contiguous number of 6+ digits is complete: what follows a space is something else.
    const first = /^\d+/.exec(group)?.[0] ?? "";
    const number = first.length >= 6 && group[first.length] === " " ? first : group;
    const digits = number.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 19) continue;
    if (AMOUNT_GROUPS.test(number)) continue;
    if (CURRENCY_AFTER.test(folded.text.slice(from + number.length))) continue;

    const span = { start: folded.at(from), end: folded.at(from + number.length) };
    const strong = keyword[1] !== undefined;
    const adjacent = strong && ADJACENT.test(folded.text.slice(after, from));
    // "chuyển tiền vào STK 123": two keywords reach one number, the stronger reading wins.
    const earlier = found.find((f) => overlaps(span, [f]));
    if (earlier) {
      earlier.strong ||= strong;
      earlier.adjacent ||= adjacent;
      continue;
    }
    const value = content.slice(span.start, span.end);
    found.push({ ...span, value, normalized: digits, strong, adjacent });
  }
  // "Tài khoản bị khoá, gọi 0901…": after a bare "tài khoản" a phone number is just a phone.
  // A wallet's account can be its phone number, so STK and its kind keep it. Digits inside a link
  // belong to the link, never to an account.
  const phones = findPhones(content);
  const urls = findUrls(content);
  return found
    .filter((f) => !overlaps(f, urls) && (f.strong || !overlaps(f, phones)))
    .sort((a, b) => a.start - b.start);
}
