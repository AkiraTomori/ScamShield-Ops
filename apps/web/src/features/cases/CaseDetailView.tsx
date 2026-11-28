import Link from "next/link";
import type { CaseDetail } from "@scamshield/shared";
import { SeedBadge } from "../../components/SeedBadge";
import { vi } from "../../copy/vi";
import { toViewModel } from "../analysis/view-model";
import { formatUpdatedAt } from "../lookup/format-time";
import { AiPanel } from "./AiPanel";
import type { IndicatorsToConfirm } from "./DecisionForm";
import { DecisionSection } from "./DecisionSection";
import { EvidencePanel } from "./EvidencePanel";
import { LIST_PATH } from "./list-url";
import { RelatedCasesPanel } from "./RelatedCasesPanel";

/** Evidence and AI judgement side by side from 1024px, evidence first (fraudops §5.2). */
export function CaseDetailView({
  detail,
  toConfirm,
}: {
  detail: CaseDetail;
  toConfirm: IndicatorsToConfirm;
}) {
  const t = vi.ops.detail;
  // The same labels and sentences as the sender's result; only the layout differs.
  const view = toViewModel(detail.analysis);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={LIST_PATH}
        className="inline-flex min-h-11 items-center self-start text-primary underline"
      >
        {t.back}
      </Link>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-mono text-xl font-bold">{detail.caseCode}</h1>
        <span className="font-semibold">{vi.ops.list.status[detail.status]}</span>
        <time dateTime={detail.createdAt}>{formatUpdatedAt(detail.createdAt)}</time>
        <span>
          {t.source} · {t.via[detail.channel]}
        </span>
        {detail.isSeed ? <SeedBadge /> : null}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <EvidencePanel detail={detail} view={view} />
        <div className="flex min-w-0 flex-col gap-4">
          <AiPanel detail={detail} view={view} />
          <RelatedCasesPanel related={detail.relatedCases} />
        </div>
      </div>
      <div className="w-full lg:w-1/2">
        {/* Keyed so nothing typed for one case can show up on another. */}
        <DecisionSection
          key={detail.caseCode}
          caseCode={detail.caseCode}
          closed={detail.status === "closed"}
          decision={detail.decision}
          toConfirm={toConfirm}
        />
      </div>
    </div>
  );
}
