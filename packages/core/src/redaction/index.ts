import type { RedactionCounts } from "@scamshield/shared";
import {
  CURRENCY_AFTER,
  findAccounts,
  findPhones,
  findUrls,
  type FoundAccount,
} from "../indicators";
import { fold, overlaps, type Folded, type Span } from "../text/fold";

/**
 * Masks the VICTIM's secrets before anything is stored, logged or sent anywhere (SO-01-AC03,
 * analysis-pipeline §5). The sender's indicators (URLs, phones, receiving accounts) stay (Q-04).
 */

export const REDACTION_LABELS: Record<keyof RedactionCounts, string> = {
  otp: "[OTP ĐÃ CHE]",
  password: "[MẬT KHẨU ĐÃ CHE]",
  card: "[SỐ THẺ ĐÃ CHE]",
};

/** `analyses.redacted_content` allows 4,000 characters; labels can lengthen hostile input. */
const MAX_REDACTED_CHARS = 4000;
const OTP_WINDOW = 40;

type Kind = keyof RedactionCounts;
type Hit = Span & { kind: Kind };

export function redact(text: string): { text: string; counts: RedactionCounts } {
  const folded = fold(text);
  const urls = findUrls(text);
  const { kept, secrets } = splitAccounts(folded, findAccounts(text));
  const phones = findPhones(text, urls);
  const senderData: Span[] = [...urls, ...phones, ...kept];
  // Around a password keyword a code-sized number after a bare "tài khoản" may be the secret
  // itself; a longer one, or one after STK, is the account the sender wants paid (Q-04).
  const named = kept.filter((account) => account.strong || account.normalized.length > 8);
  const passwords = findPasswords(text, folded, urls, [...urls, ...phones, ...named]);

  const hits: Hit[] = [];
  // Order is priority: an earlier kind wins an overlap.
  for (const hit of [
    ...findCards(text, senderData, kept),
    ...findCvv(folded),
    ...passwords.direct,
    ...findOtps(folded, senderData),
    ...secrets,
    // Last, so a code further along the clause is still labelled as an OTP.
    ...passwords.further,
  ]) {
    if (!overlaps(hit, hits)) hits.push(hit);
  }

  const counts: RedactionCounts = { otp: 0, password: 0, card: 0 };
  let out = "";
  let cursor = 0;
  for (const hit of hits.sort((a, b) => a.start - b.start)) {
    out += text.slice(cursor, hit.start) + REDACTION_LABELS[hit.kind];
    cursor = hit.end;
    counts[hit.kind] += 1;
  }
  out += text.slice(cursor);
  const points = [...out];
  if (points.length > MAX_REDACTED_CHARS) out = points.slice(0, MAX_REDACTED_CHARS).join("");
  return { text: out, counts };
}

/** A full stop, line break or similar: not the dots inside 5.000.000. */
const SENTENCE_BREAK = /[.!?;](?=\s|$)|\n/g;
const CARD_KEYWORD = /(?<![a-z0-9])(?:so the|cvv2?|cvc2?)(?![a-z0-9])/;

function sentenceAround(folded: Folded, span: Span): string {
  let start = 0;
  for (const match of folded.text.matchAll(SENTENCE_BREAK)) {
    const at = folded.at(match.index);
    if (at >= span.end) return folded.text.slice(start, match.index);
    if (at < span.start) start = match.index + 1;
  }
  return folded.text.slice(start);
}

/**
 * Which account numbers are really the sender's (Q-04). "OTP đăng nhập tài khoản của bạn là 482913"
 * is the victim's code: a number not written directly after STK / "số tài khoản" loses the
 * exemption when its sentence talks about a code or a card.
 */
function splitAccounts(
  folded: Folded,
  accounts: readonly FoundAccount[],
): { kept: FoundAccount[]; secrets: Hit[] } {
  const kept: FoundAccount[] = [];
  const secrets: Hit[] = [];
  for (const account of accounts) {
    const sentence = sentenceAround(folded, account);
    const code = sentence.search(OTP_KEYWORD) >= 0;
    if (account.adjacent || !(code || CARD_KEYWORD.test(sentence))) {
      kept.push(account);
    } else if (code && account.normalized.length <= 8) {
      // Code-sized: mask it even when the keyword is further away than the OTP window.
      secrets.push({ start: account.start, end: account.end, kind: "otp" });
    }
  }
  return { kept, secrets };
}

function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}

/** 13–19 digits passing Luhn, tried over runs of space/dash separated groups, longest first. */
function findCards(text: string, senderData: readonly Span[], accounts: readonly Span[]): Hit[] {
  const hits: Hit[] = [];
  for (const run of text.matchAll(/\d+(?:[ -]\d+)*/g)) {
    const groups = [...run[0].matchAll(/\d+/g)].map((g) => ({
      start: run.index + g.index,
      end: run.index + g.index + g[0].length,
      digits: g[0],
    }));
    let i = 0;
    while (i < groups.length) {
      let digits = "";
      let last = -1;
      for (let j = i; j < groups.length; j++) {
        digits += groups[j]?.digits ?? "";
        if (digits.length > 19) break;
        if (digits.length >= 13 && passesLuhn(digits)) last = j;
      }
      const first = groups[i];
      const end = groups[last]?.end;
      if (first && end !== undefined) {
        const span = { start: first.start, end };
        // Excused by sender data that holds the whole run, or an account number that starts it
        // ("STK 411111 1111111111"). A hotline in the middle of a card excuses nothing.
        const sender =
          senderData.some((s) => s.start <= span.start && span.end <= s.end) ||
          accounts.some((a) => a.start === span.start);
        if (!sender) hits.push({ ...span, kind: "card" });
        i = last + 1;
      } else {
        i += 1;
      }
    }
  }
  return hits;
}

function findCvv(folded: Folded): Hit[] {
  const pattern = /(?<![a-z0-9])(?:cvv2?|cvc2?)(?:\s*(?:la|:|=))?\s*(\d{3,4})(?!\d)/dg;
  return [...folded.text.matchAll(pattern)].flatMap((match) => {
    const group = match.indices?.[1];
    return group ? [{ start: folded.at(group[0]), end: folded.at(group[1]), kind: "card" }] : [];
  });
}

const PASSWORD_KEYWORD =
  /(?<![\p{L}\p{N}])(?:mat khau|mk|password|pass|ma pin|pin)(?![\p{L}\p{N}])(?:\s+(?:cua ban|cua quy khach|moi|cu|tam thoi|tam|dang nhap|giao dich)(?![\p{L}\p{N}]))*/gu;
/** `là`, `:` or `=`. Not `lạ`, not the colon of a time or of `https://`. */
const PASSWORD_SEPARATOR = /(?<![\p{L}\p{N}])(?:là|la)(?![\p{L}\p{N}])|=|:(?!\/\/)(?!(?<=\d:)\d)/iu;
/** Punctuation that ends a clause: not the dot inside `Abc.123`. */
const CLAUSE_BREAK = /[.!?;,](?=\s|$)|\n/;
/** How many descriptive words may stand between the keyword and its separator. */
const MAX_WORDS_BEFORE_SEPARATOR = 8;

/** Function words that follow a password keyword in prose: "cung cấp mật khẩu để huỷ". */
const NOT_A_PASSWORD = new Set("de va hay hoac cho qua cua khi neu thi roi sau".split(" "));

/**
 * Never masked: removing it turns "mật khẩu: không chia sẻ" into a request to share. Compared
 * with diacritics, so a password such as the name "Dung" is still masked.
 */
const NEGATIONS = new Set(["không", "khong", "đừng", "chưa"]);

/**
 * The token that holds the secret. "Mật khẩu ứng dụng là X": when a separator follows later in
 * the clause, X is the secret, not "ứng". With no separator the next token is masked unless it is
 * a function word: a harmless word lost is better than a password sent on.
 */
function findPasswords(
  text: string,
  folded: Folded,
  urls: readonly Span[],
  senderData: readonly Span[],
): { direct: Hit[]; further: Hit[] } {
  const hits: Hit[] = [];
  const further: Hit[] = [];
  const mask = (start: number, raw: string) => {
    const token = raw.replace(/[.,;!?)\]}"'…”]+$/u, "");
    if (token === "" || /^[[(/]/.test(token) || NEGATIONS.has(token.toLowerCase())) return;
    const span = { start, end: start + token.length };
    if (!overlaps(span, urls) && !overlaps(span, hits)) hits.push({ ...span, kind: "password" });
  };
  const nextToken = (from: number) => {
    const match = /^(\s*)(\S*)/.exec(text.slice(from));
    return { start: from + (match?.[1]?.length ?? 0), raw: match?.[2] ?? "" };
  };

  for (const keyword of folded.text.matchAll(PASSWORD_KEYWORD)) {
    const from = folded.at(keyword.index + keyword[0].length);
    const clause = text.slice(from).split(CLAUSE_BREAK)[0] ?? "";
    const separator = PASSWORD_SEPARATOR.exec(clause);
    const words = separator ? [...clause.slice(0, separator.index).matchAll(/\S+/g)] : [];

    if (!separator || words.length > MAX_WORDS_BEFORE_SEPARATOR) {
      const token = nextToken(from);
      if (!NOT_A_PASSWORD.has(fold(token.raw).text)) mask(token.start, token.raw);
      further.push(...secretLooking(text, from, clause, senderData));
      continue;
    }
    for (const word of words) {
      // Before the separator: anything that looks like a secret, or a lone plain word which may
      // be one ("mk banhbao là xong").
      const looksSecret = /\d|[@#$%^&*_~+]/.test(word[0]);
      const lone = words.length === 1 && /^[A-Za-z]+$/.test(word[0]);
      if (looksSecret || (lone && !NOT_A_PASSWORD.has(word[0].toLowerCase()))) {
        mask(from + word.index, word[0]);
      }
    }
    // "là:" and the like: step over every separator before reading the token.
    let after = from + separator.index + separator[0].length;
    after +=
      /^(?:\s*(?::|=|(?:là|la)(?![\p{L}\p{N}])))*/iu.exec(text.slice(after))?.[0].length ?? 0;
    const token = nextToken(after);
    mask(token.start, token.raw);
  }
  return { direct: hits, further };
}

const AMOUNT = /^\d{1,3}(?:[.,]\d{3})+|^\d+(?:d|₫|dong|vnd|k|tr|trieu|ty|usd)$/;
const DATE_OR_TIME = /^(?:\d{1,2}([/.-])\d{1,2}(?:\1\d{2,4})?|\d{1,2}[:h]\d{2})$/;

/**
 * "mã PIN thẻ 9731", "pass wifi abc12345": with no separator the secret may not be the next word.
 * Takes the words of the clause that look like one, never amounts, dates or the sender's data.
 */
function secretLooking(
  text: string,
  from: number,
  clause: string,
  senderData: readonly Span[],
): Hit[] {
  const words = [...clause.matchAll(/\S+/g)].slice(0, MAX_WORDS_BEFORE_SEPARATOR);
  return words.flatMap((word): Hit[] => {
    const token = word[0].replace(/[.,;!?)\]}"'…”]+$/u, "");
    const start = from + word.index;
    const span = { start, end: start + token.length };
    const folded = fold(token).text;
    const secret = token.length >= 4 && /\d|[@#$%^&*_~+]/.test(token) && !token.startsWith("[");
    const ordinary =
      AMOUNT.test(folded) ||
      DATE_OR_TIME.test(token) ||
      CURRENCY_AFTER.test(fold(text.slice(span.end, span.end + 8)).text) ||
      overlaps(span, senderData);
    return secret && !ordinary ? [{ ...span, kind: "password" }] : [];
  });
}

const OTP_KEYWORD =
  /(?<![a-z0-9])(?:otp|ma xac thuc|ma xac nhan|ma xac minh|ma kich hoat|verification code|code)(?![a-z0-9])/g;
/** "482913 là mã OTP": the code written before the keyword. */
const OTP_BEFORE =
  /(?<!\d)(\d{4,8})\s+(?:la|is)\s+(?:your\s+|the\s+)?(?:ma\s+)?(?:otp|xac thuc|xac nhan|xac minh|kich hoat|verification code|code)(?![a-z0-9])/dg;

function findOtps(folded: Folded, senderData: readonly Span[]): Hit[] {
  const { text } = folded;
  const hits: Hit[] = [];
  const consider = (from: number, to: number) => {
    const before = text.slice(Math.max(0, from - 2), from);
    const after = text.slice(to, to + 8);
    // Part of an amount (1.500.000), a date (21/11/2026) or an amount with a currency.
    if (/\d[.,/]$/.test(before) || /^[.,/]\d/.test(after) || CURRENCY_AFTER.test(after)) return;
    const span = { start: folded.at(from), end: folded.at(to) };
    if (!overlaps(span, senderData) && !overlaps(span, hits)) hits.push({ ...span, kind: "otp" });
  };

  for (const keyword of text.matchAll(OTP_KEYWORD)) {
    const after = keyword.index + keyword[0].length;
    for (const run of text.slice(after, after + OTP_WINDOW + 9).matchAll(/(?<!\d)\d+/g)) {
      if (run.index > OTP_WINDOW) break;
      if (run[0].length < 4 || run[0].length > 8) continue;
      consider(after + run.index, after + run.index + run[0].length);
    }
  }
  for (const match of text.matchAll(OTP_BEFORE)) {
    const group = match.indices?.[1];
    if (group) consider(group[0], group[1]);
  }
  return hits;
}
