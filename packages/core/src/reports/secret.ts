import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

/** The secret code of a case (report-flow §4.1) and its scrypt hash (data-model §6). */

/** Crockford base32: no I, L, O or U. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 8;
const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

const PARAMS = { N: 16_384, r: 8, p: 1 };
const SALT_BYTES = 16;
const KEY_BYTES = 32;

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

function derive(secret: string, salt: Buffer, params: typeof PARAMS): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, KEY_BYTES, params, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

function encode(salt: Buffer, key: Buffer): string {
  const { N, r, p } = PARAMS;
  return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  return encode(salt, await derive(secret, salt, PARAMS));
}

/** False for a wrong secret and for a stored value that is not one of our hashes. */
export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  const [scheme, N, r, p, salt, key, ...rest] = hash.split("$");
  if (scheme !== "scrypt" || !salt || !key || rest.length > 0) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await derive(secret, Buffer.from(salt, "base64"), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Compared against when there is no case to compare with, so a lookup costs the same either way
 * (report-flow §4.2). Nothing hashes to a key of zeros in practice.
 */
export const DUMMY_SECRET_HASH = encode(Buffer.alloc(SALT_BYTES), Buffer.alloc(KEY_BYTES));
