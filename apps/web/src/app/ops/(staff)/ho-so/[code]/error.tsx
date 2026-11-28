"use client";

import { ErrorState } from "../../../../../components/ErrorState";
import { vi } from "../../../../../copy/vi";

export default function CaseError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <ErrorState message={vi.ops.detail.failed} onRetry={retry} />
    </main>
  );
}
