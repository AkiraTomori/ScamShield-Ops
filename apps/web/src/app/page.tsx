import { Disclaimer } from "../components/Disclaimer";
import { vi } from "../copy/vi";

const COLUMN = "mx-auto w-full max-w-2xl p-4";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className={`${COLUMN} font-bold text-primary`}>{vi.productName}</header>
      <main className={`${COLUMN} flex flex-1 flex-col gap-3`}>
        <h1 className="text-xl font-bold">{vi.productName}</h1>
        <p>{vi.tagline}</p>
        <p>{vi.comingSoon}</p>
      </main>
      <footer className={`${COLUMN} border-t border-border`}>
        <Disclaimer />
      </footer>
    </div>
  );
}
