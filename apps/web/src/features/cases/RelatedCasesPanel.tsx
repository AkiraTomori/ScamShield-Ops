import Link from "next/link";
import { useId } from "react";
import type { CaseDetail } from "@scamshield/shared";
import { SeedBadge } from "../../components/SeedBadge";
import { SourceBadge } from "../../components/SourceBadge";
import { vi } from "../../copy/vi";
import { caseHref } from "./list-url";

/**
 * Other cases sharing an indicator (SO-07, related-cases §4.1). A plain comparison, so it is marked
 * as a check and kept out of the AI block (SO-05-AC03). Indicators are text, never links (P5).
 */
export function RelatedCasesPanel({ related }: { related: CaseDetail["relatedCases"] }) {
  const t = vi.ops.detail;
  const id = useId();
  const { total, items } = related;
  if (total === 0) return null;

  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-3 rounded-card border border-border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-bold">
          {t.relatedHeading(total)}
        </h2>
        <SourceBadge source="deterministic" />
      </div>
      {total > items.length ? <p className="text-sm">{t.relatedShown(items.length)}</p> : null}
      <ul className="flex flex-col divide-y divide-border">
        {items.map((item) => (
          <li key={item.caseCode} className="flex flex-col gap-1 py-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {/* No prefetch: each one would be a session lookup per row. */}
              <Link
                href={caseHref(item.caseCode)}
                prefetch={false}
                className="inline-flex min-h-11 items-center font-mono font-semibold text-primary underline"
              >
                {item.caseCode}
              </Link>
              <span>
                {item.decision
                  ? vi.ops.list.decision[item.decision]
                  : vi.ops.list.status[item.status]}
              </span>
              {item.isSeed ? <SeedBadge /> : null}
            </div>
            {item.sharedIndicators.map(({ type, normalized }) => (
              <p key={`${type}:${normalized}`} className="text-sm wrap-anywhere">
                {t.indicatorType[type]}: <span className="font-mono">{normalized}</span>
              </p>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
