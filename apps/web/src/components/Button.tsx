import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "border-primary bg-primary text-bg",
  secondary: "border-border-strong bg-bg text-text",
  ghost: "border-transparent bg-transparent text-primary",
} as const;

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: keyof typeof VARIANTS;
  loading?: boolean;
  /** Replaces the label while loading. */
  loadingLabel?: string;
};

export function Button({
  variant = "primary",
  loading = false,
  loadingLabel,
  type = "button",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`min-h-11 min-w-11 rounded-control border px-4 py-2 font-semibold ${VARIANTS[variant]} ${
        // The loading label is what the user reads while waiting, so it keeps full contrast.
        loading ? "cursor-wait" : "cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      }`}
    >
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
