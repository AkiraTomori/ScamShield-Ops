"use client";

import { FIXTURES } from "../../features/analysis/fixtures";
import { ResultView } from "../../features/analysis/ResultView";

const nothing = () => {};

export function Gallery() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4">
      <h1 className="text-xl font-bold">Xem trước khối kết quả (chỉ khi phát triển)</h1>
      {FIXTURES.map(({ name, result }) => (
        <div key={name} className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm text-text-muted">Mẫu: {name}</p>
          <ResultView result={result} actions={null} onRetry={nothing} />
        </div>
      ))}
    </main>
  );
}
