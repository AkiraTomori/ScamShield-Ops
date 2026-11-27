import { z } from "zod";
import { PublicCaseStatus, ReportChannel } from "./enums";
import { countInputChars } from "./input";

// Shapes of POST /api/analyses/{id}/report and POST /api/case-status (api.md §3). Browser-safe.

/** What the user may type (O-04). The column allows more: redaction labels are longer (RP-01). */
export const REPORT_NOTE_MAX_CHARS = 500;
export const CASE_LOOKUP_MAX_CHARS = 32;

export const REPORT_ERROR_MESSAGE_VI = {
  channel: "Hãy chọn nơi bạn nhận tin.",
  note: "Ghi chú tối đa 500 ký tự.",
} as const;

/** One message for a wrong code, a wrong secret and a case that does not exist (SO-04-AC04). */
export const CASE_NOT_FOUND_MESSAGE_VI = "Không tìm thấy báo cáo khớp với hai mã này.";

/** The `{analysisId}` of the report path; anything else must not reach the database. */
export const AnalysisId = z.uuid();

export const ReportRequest = z
  .object({
    channel: ReportChannel,
    note: z
      .string()
      .refine(
        (note) => countInputChars(note) <= REPORT_NOTE_MAX_CHARS,
        REPORT_ERROR_MESSAGE_VI.note,
      )
      .optional(),
  })
  .strict();
export type ReportRequest = z.infer<typeof ReportRequest>;

export const ReportResponse = z
  .object({
    caseCode: z.string().min(1),
    /** Shown once, as two groups of four (RP-05); null when the report already existed. */
    secretCode: z.string().min(1).nullable(),
    alreadyReported: z.boolean(),
  })
  .strict();
export type ReportResponse = z.infer<typeof ReportResponse>;

const lookupField = z
  .string()
  .max(CASE_LOOKUP_MAX_CHARS)
  .refine((value) => value.trim() !== "");

export const CaseStatusRequest = z
  .object({ caseCode: lookupField, secretCode: lookupField })
  .strict();
export type CaseStatusRequest = z.infer<typeof CaseStatusRequest>;

export const CaseStatusResponse = z
  .object({ caseCode: z.string().min(1), status: PublicCaseStatus, updatedAt: z.iso.datetime() })
  .strict();
export type CaseStatusResponse = z.infer<typeof CaseStatusResponse>;
