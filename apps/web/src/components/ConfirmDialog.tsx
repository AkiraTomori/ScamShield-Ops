"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "./Button";

/**
 * A modal question (design-system §4). The native dialog traps focus and closes on Esc; closing it
 * before telling the caller returns focus to the control that opened it.
 */
export function ConfirmDialog({
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const messageId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // First focus goes to the choice that loses nothing. Not `autoFocus`: React applies it before
    // the dialog is open, and the browser would then pick the first button.
    cancelRef.current?.focus();
  }, []);

  const close = (then: () => void) => {
    ref.current?.close();
    then();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        close(onCancel);
      }}
      className="m-auto w-full max-w-sm rounded-card border border-border-strong bg-bg p-4 text-text backdrop:bg-text/50"
    >
      <p id={messageId} className="font-semibold">
        {message}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Button onClick={() => close(onConfirm)}>{confirmLabel}</Button>
        <Button ref={cancelRef} variant="secondary" onClick={() => close(onCancel)}>
          {cancelLabel}
        </Button>
      </div>
    </dialog>
  );
}
