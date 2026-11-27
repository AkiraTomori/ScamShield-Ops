import { Disclaimer } from "../components/Disclaimer";
import { vi } from "../copy/vi";
import { AnalysisFeature } from "../features/analysis/AnalysisFeature";

const COLUMN = "mx-auto w-full max-w-2xl p-4";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className={`${COLUMN} flex items-center justify-between gap-2`}>
        <span className="font-bold text-primary">{vi.productName}</span>
        {/* A full load, not client navigation: the browser then warns before codes are lost. */}
        <a
          href="/tra-cuu"
          className="inline-flex min-h-11 items-center text-sm text-primary underline"
        >
          {vi.caseStatus.nav}
        </a>
      </header>
      <main className={`${COLUMN} flex flex-1 flex-col gap-3`}>
        <h1 className="text-xl font-bold">{vi.analysis.heading}</h1>
        <p>{vi.analysis.intro}</p>
        <AnalysisFeature />
      </main>
      <footer className={`${COLUMN} border-t border-border`}>
        <Disclaimer />
      </footer>
    </div>
  );
}
