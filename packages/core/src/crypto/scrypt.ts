import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** scrypt hashing of case secret codes and staff passwords (data-model §6, backend §7). */

const PARAMS = { N: 16_384, r: 8, p: 1 };
const SALT_BYTES = 16;
const KEY_BYTES = 32;

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
 * Compared against when there is nothing to compare with (no such case, no such user), so the answer
 * costs the same either way (report-flow §4.2, fraudops §3.1). Nothing hashes to a key of zeros in
 * practice.
 */
export const DUMMY_SECRET_HASH = encode(Buffer.alloc(SALT_BYTES), Buffer.alloc(KEY_BYTES));
