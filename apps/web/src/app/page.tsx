import { vi } from "../copy/vi";

export default function HomePage() {
  return (
    <div className="page">
      <header className="header">{vi.productName}</header>
      <main className="main">
        <h1>{vi.productName}</h1>
        <p>{vi.tagline}</p>
        <p>{vi.comingSoon}</p>
      </main>
      <footer className="footer">
        <p>{vi.disclaimer}</p>
      </footer>
    </div>
  );
}
