import { z } from "zod";
import { CaseStatus, Decision, MatchableIndicatorType, RiskType, Verdict } from "./enums";
import { countInputChars, standardizeText } from "./input";

// Shapes of the FraudOps routes (api.md §4). Browser-safe.

export const LOGIN_USERNAME_MAX_CHARS = 64;
export const LOGIN_PASSWORD_MAX_CHARS = 200;

export const LoginRequest = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(LOGIN_USERNAME_MAX_CHARS)
      // The name reaches a query, and Postgres rejects a NUL. The password is only hashed.
      .regex(/^[^\p{Cc}\p{Cs}]*$/u),
    /** Taken as typed: no trimming, no case folding. */
    password: z.string().min(1).max(LOGIN_PASSWORD_MAX_CHARS),
  })
  .strict();
export type LoginRequest = z.infer<typeof LoginRequest>;

export const CaseStatusFilter = z.enum([...CaseStatus.options, "all"]);
export type CaseStatusFilter = z.infer<typeof CaseStatusFilter>;

/** The case list filters (fraudops §4). A value nobody offered falls back instead of failing. */
export const CaseListQuery = z.object({
  status: CaseStatusFilter.catch("pending_review"),
  verdict: Verdict.nullable().catch(null),
  /** As typed. When not empty the status filter is ignored. */
  code: z.string().trim().catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});
export type CaseListQuery = z.infer<typeof CaseListQuery>;

export const CaseListItem = z
  .object({
    caseCode: z.string().min(1),
    createdAt: z.iso.datetime(),
    engineVerdict: Verdict,
    riskTypes: z.array(RiskType),
    status: CaseStatus,
    isSeed: z.boolean(),
    /** Null while the case is waiting. */
    decision: Decision.nullable(),
    /** Other cases sharing an indicator (SO-07). */
    relatedCount: z.number().int().nonnegative(),
  })
  .strict();
export type CaseListItem = z.infer<typeof CaseListItem>;

export const CaseListPage = z
  .object({
    items: z.array(CaseListItem),
    /** The page returned, which is the last one when a later page was asked for. */
    page: z.number().int().min(1),
    totalPages: z.number().int().min(1),
    /** False only when there is no case at all, whatever the filters. */
    hasAnyCase: z.boolean(),
  })
  .strict();
export type CaseListPage = z.infer<typeof CaseListPage>;

export const DECISION_REASON_MIN_CHARS = 10;
export const DECISION_REASON_MAX_CHARS = 500;

export const DECISION_ERROR_MESSAGE_VI = {
  decision: "Hãy chọn một kết luận.",
  reason: "Lý do cần từ 10 đến 500 ký tự.",
} as const;

/** A reason a staff member types: 10–500 characters. */
const StaffReason = z
  .string()
  .refine((reason) => {
    const length = countInputChars(reason);
    return length >= DECISION_REASON_MIN_CHARS && length <= DECISION_REASON_MAX_CHARS;
  }, DECISION_ERROR_MESSAGE_VI.reason)
  // What is counted is what is stored: the database checks the length too.
  .transform(standardizeText);

/** Body of POST /api/ops/cases/{caseCode}/decision (SO-06-AC03). */
export const DecisionRequest = z.object({ decision: Decision, reason: StaffReason }).strict();
export type DecisionRequest = z.infer<typeof DecisionRequest>;

export const ALREADY_REMOVED_MESSAGE_VI = "Chỉ dấu này đã được gỡ trước đó.";

/** The `{id}` of a confirmed indicator. */
export const IndicatorId = z.uuid();

/** One active row of the confirmed list, as `/ops/chi-dau` shows it (verified-indicators §6). */
export const ConfirmedIndicatorItem = z
  .object({
    id: IndicatorId,
    type: MatchableIndicatorType,
    normalized: z.string(),
    sourceCaseCode: z.string().min(1),
    confirmedAt: z.iso.datetime(),
    /** Display name of the staff member. */
    confirmedBy: z.string().min(1),
  })
  .strict();
export type ConfirmedIndicatorItem = z.infer<typeof ConfirmedIndicatorItem>;

export const ConfirmedIndicatorPage = z
  .object({
    items: z.array(ConfirmedIndicatorItem),
    /** The page returned, which is the last one when a later page was asked for. */
    page: z.number().int().min(1),
    totalPages: z.number().int().min(1),
  })
  .strict();
export type ConfirmedIndicatorPage = z.infer<typeof ConfirmedIndicatorPage>;

/** Body of POST /api/ops/confirmed-indicators/{id}/removal (SO-08-AC03, verified-indicators §5). */
export const IndicatorRemovalRequest = z.object({ reason: StaffReason }).strict();
export type IndicatorRemovalRequest = z.infer<typeof IndicatorRemovalRequest>;

export const IndicatorRemovalResponse = z.object({ removed: z.literal(true) }).strict();
export type IndicatorRemovalResponse = z.infer<typeof IndicatorRemovalResponse>;
