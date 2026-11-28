import Link from "next/link";
import type { ReactNode } from "react";
import { vi } from "../../../copy/vi";
import { LogoutButton } from "../../../features/auth/LogoutButton";
import { getStaffSession } from "../../../server/ops-session";

// Shows who is signed in. It guards nothing: a layout does not rerun on client navigation, so every
// page calls requireStaffPage itself (fraudops §2).
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const session = await getStaffSession();
  return (
    <>
      {session ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
          <div className="flex items-center gap-4">
            <span className="font-bold">{vi.ops.productName}</span>
            <nav>
              <Link
                href="/ops"
                className="inline-flex min-h-11 items-center text-primary underline"
              >
                {vi.ops.cases}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span>{session.displayName}</span>
            <LogoutButton />
          </div>
        </header>
      ) : null}
      {children}
    </>
  );
}
