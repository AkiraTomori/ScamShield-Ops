"use client";

import { ErrorState } from "../../../components/ErrorState";
import { vi } from "../../../copy/vi";

// `retry` fetches and renders the segment again; `reset` would only redraw the failed result.
export default function CasesError({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <ErrorState message={vi.ops.list.failed} onRetry={retry} />
    </main>
  );
}
