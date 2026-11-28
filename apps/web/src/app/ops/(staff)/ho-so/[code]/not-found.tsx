"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { vi } from "../../../../../copy/vi";

export default function CaseNotFound() {
  const { code } = useParams<{ code: string }>();
  // The address is anyone's text: only something shaped like a case code is repeated back.
  const known = /^SC-\d{4,10}$/i.test(code) ? code.toUpperCase() : null;
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-start gap-3 px-4 py-6">
      <h1 className="text-xl font-bold">{vi.ops.detail.notFound(known)}</h1>
      <Link href="/ops" className="inline-flex min-h-11 items-center text-primary underline">
        {vi.ops.detail.backToList}
      </Link>
    </main>
  );
}
