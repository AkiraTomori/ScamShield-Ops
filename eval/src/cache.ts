import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { RunRecord } from "./record";

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

const slug = (model: string) => model.replace(/[^a-zA-Z0-9._-]/g, "_");

/** One cache file per (model, case-file hash, prompt versions), so stale runs never mix. */
export function cachePath(dir: string, model: string, casesSha: string, promptTag: string): string {
  return join(dir, `${slug(model)}__${casesSha.slice(0, 8)}__${promptTag}.jsonl`);
}

/**
 * Hand-grading sheet for the same (model, case-file hash, prompt versions) as the cache file.
 * Lives in the committed results folder, so the scores typed by hand are kept with the numbers.
 */
export function gradingSheetPath(
  dir: string,
  model: string,
  casesSha: string,
  promptTag: string,
): string {
  return join(dir, `q08-grading-${slug(model)}__${casesSha.slice(0, 8)}__${promptTag}.md`);
}

export function readCache(path: string): RunRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as RunRecord);
}

export function appendRecord(path: string, record: RunRecord): void {
  mkdirSync(join(path, ".."), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`);
}

export function clearCache(path: string): void {
  rmSync(path, { force: true });
}

/** True when a record failed for infrastructure reasons (outage, timeout), not model behaviour. */
export function isInfraFailure(record: RunRecord): boolean {
  const infra = (reason: string) => reason === "llm_unavailable" || reason === "timeout";
  return (
    (!record.signals.ok && infra(record.signals.reason)) ||
    (!record.explanation.ok && infra(record.explanation.reason))
  );
}

/** Rewrites the cache without infra failures so `--resume` runs them again. Returns how many. */
export function dropInfraFailures(path: string): number {
  const all = readCache(path);
  const kept = all.filter((r) => !isInfraFailure(r));
  clearCache(path);
  for (const r of kept) appendRecord(path, r);
  return all.length - kept.length;
}
