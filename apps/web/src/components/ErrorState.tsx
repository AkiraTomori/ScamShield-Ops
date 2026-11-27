import { vi } from "../copy/vi";
import { Button } from "./Button";

/** `onRetry` is optional: without it no retry button is shown. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-card border border-danger p-4"
    >
      <p className="text-danger">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {vi.retry}
        </Button>
      ) : null}
    </div>
  );
}
