import type { TextareaHTMLAttributes } from "react";
import { fieldAria } from "./field";

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "id"> & {
  id: string;
  label: string;
  error?: string;
  /** Id of the `CharCounter` shown with this field. */
  counterId?: string;
};

export function TextArea({ id, label, error, counterId, rows = 6, ...rest }: TextAreaProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {/* text-md (16px) keeps iOS from zooming in on focus. */}
      <textarea
        {...rest}
        {...fieldAria({ counterId, errorId, hasError: Boolean(error) })}
        id={id}
        rows={rows}
        className="w-full rounded-control border border-border-strong bg-bg p-3 font-mono text-md aria-invalid:border-danger"
      />
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
