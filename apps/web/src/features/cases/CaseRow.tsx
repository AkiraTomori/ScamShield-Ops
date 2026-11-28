"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A table row that opens its case wherever it is clicked. Keyboard and screen reader users have the
 * real link inside it; this adds only the mouse shortcut.
 */
export function CaseRow({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className="cursor-pointer border-b border-border align-top hover:bg-surface-subtle"
      onClick={(event) => {
        // The link handles itself, including "open in new tab"; selecting text is not a click.
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        if ((event.target as Element).closest("a") || window.getSelection()?.toString()) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
