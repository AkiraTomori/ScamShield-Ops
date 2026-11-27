import type { Metadata } from "next";
import { Disclaimer } from "../../components/Disclaimer";
import { vi } from "../../copy/vi";
import { CaseStatusFeature } from "../../features/lookup/CaseStatusFeature";

export const metadata: Metadata = { title: `${vi.caseStatus.nav} · ${vi.productName}` };

const COLUMN = "mx-auto w-full max-w-2xl p-4";

export default function CaseStatusPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className={`${COLUMN} flex items-center justify-between gap-2`}>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load, as for the link to /tra-cuu */}
        <a href="/" className="inline-flex min-h-11 items-center font-bold text-primary">
          {vi.productName}
        </a>
        <span className="text-sm text-text-muted">{vi.caseStatus.nav}</span>
      </header>
      <main className={`${COLUMN} flex flex-1 flex-col gap-3`}>
        <h1 className="text-xl font-bold">{vi.caseStatus.heading}</h1>
        <CaseStatusFeature />
      </main>
      <footer className={`${COLUMN} border-t border-border`}>
        <Disclaimer />
      </footer>
    </div>
  );
}
