import Link from "next/link";
import type { CaseListPage, CaseListQuery } from "@scamshield/shared/ops";
import { SeedBadge } from "../../components/SeedBadge";
import { VerdictBadge } from "../../components/VerdictBadge";
import { vi } from "../../copy/vi";
import { formatShortTime } from "../lookup/format-time";
import { CaseRow } from "./CaseRow";
import { caseHref, caseListHref, LIST_PATH, PARAM } from "./list-url";

const CELL = "px-3 py-2";
const LINK = "inline-flex min-h-11 items-center text-primary underline";

function Pagination({ page, query }: { page: CaseListPage; query: CaseListQuery }) {
  const t = vi.ops.list;
  const link = (target: number, label: string) =>
    target >= 1 && target <= page.totalPages ? (
      <Link href={caseListHref({ ...query, page: target })} className={LINK}>
        {label}
      </Link>
    ) : (
      <span aria-disabled="true" className="inline-flex min-h-11 items-center text-text-muted">
        {label}
      </span>
    );
  return (
    <nav aria-label={t.pagesLabel} className="flex items-center justify-end gap-4">
      {link(page.page - 1, t.previous)}
      <span>{t.pageOf(page.page, page.totalPages)}</span>
      {link(page.page + 1, t.next)}
    </nav>
  );
}

/** The queue as a table, or why there is nothing to show (ui-pages §5). */
export function CaseList({ page, query }: { page: CaseListPage; query: CaseListQuery }) {
  const t = vi.ops.list;
  if (!page.hasAnyCase) return <p>{t.empty}</p>;
  if (page.items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p>{t.noMatch}</p>
        {/* Every filter off, so this never leads back to the same empty view. */}
        <Link href={`${LIST_PATH}?${PARAM.status}=all`} className={LINK}>
          {t.clear}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {/* The table scrolls, not the page, on a narrow window. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-2xl text-left text-sm">
          <thead>
            <tr className="border-b border-border-strong">
              {[t.columnCode, t.columnTime, t.verdictLabel, t.columnRisks, t.statusLabel].map(
                (heading) => (
                  <th key={heading} scope="col" className={CELL}>
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {page.items.map((item) => (
              <CaseRow key={item.caseCode} href={caseHref(item.caseCode)}>
                <th scope="row" className={`${CELL} whitespace-nowrap`}>
                  <div className="flex flex-col items-start gap-1">
                    {/* No prefetch: each one would be a session lookup per row. */}
                    <Link
                      href={caseHref(item.caseCode)}
                      prefetch={false}
                      className="font-mono font-semibold text-primary underline"
                    >
                      {item.caseCode}
                    </Link>
                    {item.isSeed ? <SeedBadge /> : null}
                  </div>
                </th>
                <td className={`${CELL} whitespace-nowrap`}>
                  <time dateTime={item.createdAt}>{formatShortTime(item.createdAt)}</time>
                </td>
                <td className={CELL}>
                  <VerdictBadge verdict={item.engineVerdict} />
                </td>
                <td className={CELL}>
                  {item.riskTypes.map((risk) => t.riskType[risk]).join(", ") || "—"}
                </td>
                <td className={CELL}>
                  {t.status[item.status]}
                  {item.decision ? (
                    <span className="block text-text-muted">{t.decision[item.decision]}</span>
                  ) : null}
                </td>
              </CaseRow>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} query={query} />
    </div>
  );
}
