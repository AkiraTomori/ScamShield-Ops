import type { Ref } from "react";
import { CodeWithCopy } from "../../components/CodeWithCopy";
import { vi } from "../../copy/vi";

const BOX = "flex flex-col gap-3 rounded-card border border-border p-4";

/** A new tab: leaving this page would lose the secret code. */
function LookupLink() {
  return (
    <a
      href="/tra-cuu"
      target="_blank"
      rel="noopener"
      className="inline-flex min-h-11 items-center font-semibold text-primary underline"
    >
      {vi.report.lookupLink} {vi.report.newTab}
    </a>
  );
}

/** After a new report: the only time the secret code is shown (SO-04-AC01, AC04). */
export function ReportSent({
  caseCode,
  secretCode,
  headingRef,
}: {
  caseCode: string;
  secretCode: string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className={BOX}>
      <h3 ref={headingRef} tabIndex={-1} className="text-lg font-bold">
        {vi.report.sent}
      </h3>
      <CodeWithCopy label={vi.report.caseCode} code={caseCode} />
      <CodeWithCopy label={vi.report.secretCode} code={secretCode} />
      <p className="font-semibold">{vi.report.keepCodes}</p>
      <LookupLink />
    </div>
  );
}

/** The report already existed: no secret code (SO-04-AC03, report-flow §2.2). */
export function ReportAlreadySent({
  caseCode,
  headingRef,
}: {
  caseCode: string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className={BOX}>
      <h3 ref={headingRef} tabIndex={-1} className="text-lg font-bold">
        {vi.report.alreadySent}
      </h3>
      <CodeWithCopy label={vi.report.caseCode} code={caseCode} />
      <p>{vi.report.useSavedSecret}</p>
      <p>{vi.report.secretLost}</p>
      <LookupLink />
    </div>
  );
}
