import type { CaseStatusResponse } from "@scamshield/shared/report";
import { StatusBadge } from "../../components/StatusBadge";
import { vi } from "../../copy/vi";
import { formatUpdatedAt } from "./format-time";

export function StatusResult({ result }: { result: CaseStatusResponse }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border p-4">
      <h2 className="text-lg font-bold">{vi.caseStatus.caseTitle(result.caseCode)}</h2>
      <StatusBadge status={result.status} />
      <p>{vi.publicStatus[result.status].explanation}</p>
      <p className="text-sm text-text-muted">
        {vi.caseStatus.updatedAt(formatUpdatedAt(result.updatedAt))}
      </p>
    </div>
  );
}
