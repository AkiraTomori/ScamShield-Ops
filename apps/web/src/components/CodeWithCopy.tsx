"use client";

import { useRef, useState } from "react";
import { vi } from "../copy/vi";
import { Button } from "./Button";

/** A case or secret code with a copy button (design-system §4). */
export function CodeWithCopy({ label, code }: { label: string; code: string }) {
  const [copy, setCopy] = useState<"idle" | "done" | "manual">("idle");
  const codeRef = useRef<HTMLElement>(null);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopy("done");
    } catch {
      // Blocked, or not a secure context: select the code so the user can copy it.
      if (codeRef.current) window.getSelection()?.selectAllChildren(codeRef.current);
      setCopy("manual");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="font-semibold">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code
          ref={codeRef}
          className="rounded-control border border-border-strong bg-bg px-3 py-2 font-mono text-lg wrap-anywhere"
        >
          {code}
        </code>
        <Button
          variant="secondary"
          aria-label={`${vi.copyCode.action} ${label.toLowerCase()}`}
          onClick={copyCode}
        >
          {vi.copyCode.action}
        </Button>
      </div>
      <p aria-live="polite" className="text-sm text-text-muted">
        {copy === "idle" ? "" : vi.copyCode[copy]}
      </p>
    </div>
  );
}
