"use client";

import { useState } from "react";
import { Button } from "../../components/Button";
import { vi } from "../../copy/vi";
import { submitLogout } from "./submit-session";

export function LogoutButton() {
  const [state, setState] = useState<"idle" | "sending" | "failed">("idle");

  async function signOut() {
    setState("sending");
    if (await submitLogout()) {
      // A full load on purpose: it drops pages the client router cached while signed in.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/ops/dang-nhap");
      return;
    }
    setState("failed");
  }

  return (
    <div className="flex items-center gap-2">
      {/* Always mounted: a live region that appears already filled is often not read. */}
      <p aria-live="polite" className="text-sm text-danger">
        {state === "failed" ? vi.ops.logoutFailed : null}
      </p>
      <Button
        variant="secondary"
        loading={state === "sending"}
        loadingLabel={vi.ops.loggingOut}
        onClick={() => void signOut()}
      >
        {vi.ops.logout}
      </Button>
    </div>
  );
}
