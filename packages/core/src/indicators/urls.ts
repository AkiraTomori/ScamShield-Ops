import { isIP } from "node:net";
import { parse as parseDomain } from "tldts";
import { overlaps, type Span } from "../text/fold";

/**
 * Finds URLs and bare domains in message text (analysis-pipeline §6.1). This is string parsing
 * only: nothing here, or anywhere downstream, opens what it finds (P5).
 */

export interface FoundUrl extends Span {
  /** Exactly as written in the content, disguises included. */
  value: string;
  /** Canonical form: `new URL().href` without a leading `www.`. */
  normalized: string;
  /** ASCII host, lowercase, without `www.`. */
  host: string;
  isIp: boolean;
  /** Registrable domain in ASCII; null for IP and single-label hosts. */
  domain: string | null;
  /** The part of `value` to show for the registrable domain. */
  domainValue: string | null;
  publicSuffix: string | null;
  /** Labels left of the registrable domain, without `www`; empty when there are none. */
  subdomain: string;
}

/** TLDs reserved for documentation and tests, accepted because demo and eval data use them. */
const EXTRA_TLDS = new Set(["example", "test"]);

const DISGUISES: [RegExp, string][] = [
  [/\[\.\]|\(\.\)|\{\.\}| dot /iy, "."],
  [/hxxp/iy, "http"],
];

/** Undoes `[.]`, ` dot `, `hxxp` on a copy, remembering where every character came from. */
function undisguise(text: string): { text: string; at: (i: number) => number } {
  let out = "";
  const map: number[] = [];
  let i = 0;
  while (i < text.length) {
    let replaced = false;
    for (const [pattern, replacement] of DISGUISES) {
      pattern.lastIndex = i;
      const match = pattern.exec(text);
      if (!match) continue;
      for (let k = 0; k < replacement.length; k++) map.push(i);
      out += replacement;
      i += match[0].length;
      replaced = true;
      break;
    }
    if (replaced) continue;
    map.push(i);
    out += text[i];
    i += 1;
  }
  return { text: out, at: (k) => map[k] ?? text.length };
}

/** Characters that end a URL in running text: whitespace, brackets of markup, quotes. */
const STOP = "\\s<>\"'`“”«»";
const SCHEME_URL = new RegExp(`https?://[^${STOP}]+`, "giu");
const LABEL = String.raw`[\p{L}\p{N}][\p{L}\p{M}\p{N}_-]*`;
const BARE_URL = new RegExp(
  String.raw`(?<![\p{L}\p{M}\p{N}_@./-])(?:${LABEL}\.)+${LABEL}(?::\d{1,5})?` + `(?:/[^${STOP}]*)?`,
  "gu",
);
const TRAILING = /[.,;:!?)\]}>…'-]+$/u;

export function findUrls(content: string): FoundUrl[] {
  const clean = undisguise(content);
  const found: FoundUrl[] = [];

  const add = (match: RegExpMatchArray, hasScheme: boolean) => {
    const raw = match[0].replace(TRAILING, "");
    const from = match.index ?? 0;
    const to = from + raw.length;
    const start = clean.at(from);
    // The end of the last matched character, so a trailing disguise is not half-included.
    const end = clean.at(to - 1) + 1;
    if (overlaps({ start, end }, found)) return;
    // `name@host` without a scheme is an e-mail address, not a link.
    if (!hasScheme && clean.text[to] === "@") return;
    const parsed = parseCandidate(raw, hasScheme);
    if (!parsed) return;
    const { domainAt, ...url } = parsed;
    // Cut from the original, so a disguise shows as it was written.
    const domainValue = domainAt
      ? content.slice(clean.at(from + domainAt.start), clean.at(from + domainAt.end - 1) + 1)
      : null;
    found.push({ start, end, value: content.slice(start, end), domainValue, ...url });
  };

  for (const match of clean.text.matchAll(SCHEME_URL)) add(match, true);
  for (const match of clean.text.matchAll(BARE_URL)) add(match, false);
  return found.sort((a, b) => a.start - b.start);
}

type Parsed = Omit<FoundUrl, "start" | "end" | "value" | "domainValue"> & {
  /** Where the registrable domain sits inside the candidate. */
  domainAt: Span | null;
};

function parseCandidate(raw: string, hasScheme: boolean): Parsed | null {
  const schemeLength = /^https?:\/\//i.exec(raw)?.[0].length ?? 0;
  const authority = raw.slice(schemeLength).split(/[/?#]/)[0] ?? "";
  const hostStart = schemeLength + authority.lastIndexOf("@") + 1;
  const displayHost = authority.slice(authority.lastIndexOf("@") + 1).replace(/:\d+$/, "");

  // A bare IPv4 counts only as four written octets followed by a port or path (SO-02-AC02).
  const bareIp =
    !hasScheme &&
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(displayHost) &&
    /^[:/]/.test(raw.slice(displayHost.length));

  // Abbreviations never carry a path; "Bit.ly/3xyz", capitalised by a phone keyboard, does.
  const hasPath = /^(?::\d+)?\/\S/.test(raw.slice(displayHost.length));
  if (!hasScheme && !hasPath) {
    const labels = displayHost.split(".");
    // Vietnamese abbreviations (TP.HCM, ThS.BS) and a missing space after a full stop (ơn.Vui).
    if (/^\p{Lu}\p{Ll}+$/u.test(labels.at(-1) ?? "")) return null;
    if (labels.every((l) => l.length <= 3) && /\p{Lu}/u.test(displayHost)) return null;
  }

  let url: URL;
  try {
    url = new URL(hasScheme ? raw : `http://${raw}`);
  } catch {
    return null;
  }
  url.hostname = url.hostname.replace(/\.$/, "").replace(/^www\./, "");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const isIp = isIP(host) !== 0;
  // Private suffixes count: `shop.pages.dev` belongs to its tenant, not to `pages.dev`.
  const info = isIp ? null : parseDomain(host, { allowPrivateDomains: true });

  if (!hasScheme && !(bareIp && isIp)) {
    const tld = host.split(".").at(-1) ?? "";
    const known = Boolean(info?.isIcann || info?.isPrivate) || EXTRA_TLDS.has(tld);
    if (!known || !info?.domain) return null;
  }

  const domain = info?.domain ?? null;
  const labelCount = domain?.split(".").length ?? 0;
  const written = displayHost.replace(/\.$/, "");
  const shown = written.split(".").slice(-labelCount).join(".");
  const domainEnd = hostStart + written.length;
  return {
    normalized: url.href,
    host,
    isIp,
    domain,
    domainAt: domain ? { start: domainEnd - shown.length, end: domainEnd } : null,
    publicSuffix: info?.publicSuffix ?? null,
    subdomain: info?.subdomain ?? "",
  };
}
