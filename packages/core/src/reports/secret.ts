import { randomInt } from "node:crypto";

/** The secret code of a case (report-flow §4.1). */

/** Crockford base32: no I, L, O or U. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 8;
const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

/** An integer in `[0, max)`. Injectable for tests. */
export type RandomInt = (max: number) => number;

export function generateSecretCode(random: RandomInt = randomInt): string {
  return Array.from({ length: CODE_LENGTH }, () => ALPHABET[random(ALPHABET.length)]).join("");
}

export function formatSecretCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** The form that is hashed; null when the input cannot be a code. */
export function normalizeSecretCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  return CODE_PATTERN.test(code) ? code : null;
}

export { DUMMY_SECRET_HASH, hashSecret, verifySecret } from "../crypto/scrypt";
