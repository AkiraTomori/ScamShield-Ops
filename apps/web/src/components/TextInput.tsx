import type { InputHTMLAttributes, Ref } from "react";
import { fieldAria } from "./field";

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id"> & {
  id: string;
  label: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
};

export function TextInput({ id, label, error, type = "text", ...rest }: TextInputProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <input
        {...rest}
        {...fieldAria({ errorId, hasError: Boolean(error) })}
        id={id}
        type={type}
        className="min-h-11 w-full rounded-control border border-border-strong bg-bg px-3 font-mono text-md aria-invalid:border-danger"
      />
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
