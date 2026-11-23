import type {
  ChatJsonResult,
  ExtractSignalsResult,
  WriteExplanationResult,
} from "@scamshield/core";

/** Everything kept for one (model, case, run). Written to eval/.cache/ as one JSONL line. */
export interface RunRecord {
  model: string;
  caseId: string;
  run: number;
  at: string;
  signals: ExtractSignalsResult;
  explanation: WriteExplanationResult;
  /** Raw provider results per step (text, finish reason). Never committed. */
  raw: { step: "signals" | "explain"; result: ChatJsonResult }[];
  /** 429 responses seen (and waited out) while producing this record. */
  rateLimited: number;
}
