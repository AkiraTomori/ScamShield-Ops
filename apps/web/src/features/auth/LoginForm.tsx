"use client";

import { useRef, useState } from "react";
import { ERROR_MESSAGE_VI } from "@scamshield/shared/errors";
import {
  LOGIN_PASSWORD_MAX_CHARS,
  LOGIN_USERNAME_MAX_CHARS,
  LoginRequest,
} from "@scamshield/shared/ops";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { TextInput } from "../../components/TextInput";
import { vi } from "../../copy/vi";
import { submitLogin } from "./submit-session";

/** `next` was already checked on the server (safeNextPath). */
export function LoginForm({ next }: { next: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);

  async function signIn() {
    const body = LoginRequest.safeParse({ username, password });
    if (!body.success) {
      setError(vi.ops.login.missing);
      return;
    }
    inFlight.current = true;
    setSending(true);
    setError(null);
    const outcome = await submitLogin(body.data);
    if (outcome.kind === "signed_in") {
      // A full load, so no page rendered while signed out is reused. The button stays busy.
      window.location.assign(next);
      return;
    }
    inFlight.current = false;
    setSending(false);
    setError(
      outcome.kind === "invalid_credentials"
        ? ERROR_MESSAGE_VI.invalid_credentials
        : outcome.kind === "rate_limited"
          ? ERROR_MESSAGE_VI.rate_limited
          : vi.ops.login.failed,
    );
  }

  return (
    <form
      noValidate
      // Never GET: a submit before hydration must not put the password on the URL.
      method="post"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!inFlight.current) void signIn();
      }}
    >
      <TextInput
        id="username"
        name="username"
        label={vi.ops.login.username}
        maxLength={LOGIN_USERNAME_MAX_CHARS}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        readOnly={sending}
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />
      <TextInput
        id="password"
        name="password"
        type="password"
        label={vi.ops.login.password}
        maxLength={LOGIN_PASSWORD_MAX_CHARS}
        autoComplete="current-password"
        readOnly={sending}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error ? <ErrorState message={error} /> : null}
      <Button type="submit" loading={sending} loadingLabel={vi.ops.login.submitting}>
        {vi.ops.login.submit}
      </Button>
    </form>
  );
}
