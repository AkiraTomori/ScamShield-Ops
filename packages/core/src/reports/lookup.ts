import { CaseStatusResponse, PublicCaseStatus, type CaseStatusRequest } from "@scamshield/shared";
import { eq } from "drizzle-orm";
import { cases, decisions } from "../db/schema";
import type { Db } from "../rate-limit";
import { DUMMY_SECRET_HASH, normalizeSecretCode, verifySecret } from "./secret";

/** `101` and `sc-0101` both mean `SC-0101`; null when it cannot be a case code. */
export function normalizeCaseCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  if (/^\d{1,4}$/.test(code)) return `SC-${code.padStart(4, "0")}`;
  return /^SC-\d{4,}$/.test(code) ? code : null;
}

/**
 * The reporter's view of a case (SO-04-AC04). Null for every mismatch, whichever half was wrong, and
 * each of them costs one scrypt run so timing does not tell them apart (report-flow §4.2).
 */
export async function lookupPublicStatus(
  req: CaseStatusRequest,
  deps: { db: Db },
): Promise<CaseStatusResponse | null> {
  const code = normalizeCaseCode(req.caseCode);
  const [row] = code
    ? await deps.db
        .select({
          code: cases.code,
          secretHash: cases.secretHash,
          status: cases.status,
          updatedAt: cases.updatedAt,
          decision: decisions.decision,
        })
        .from(cases)
        .leftJoin(decisions, eq(decisions.caseId, cases.id))
        .where(eq(cases.code, code))
    : [];

  const secret = normalizeSecretCode(req.secretCode);
  const matches = await verifySecret(secret ?? "", row?.secretHash ?? DUMMY_SECRET_HASH);
  if (!row || !secret || !matches) return null;

  return CaseStatusResponse.parse({
    caseCode: row.code,
    status: PublicCaseStatus.parse(row.status === "closed" ? row.decision : row.status),
    updatedAt: row.updatedAt.toISOString(),
  });
}
