import { hashSecret, verifySecret } from "../crypto/scrypt";

export function hashPassword(password: string): Promise<string> {
  return hashSecret(password);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return verifySecret(password, hash);
}
