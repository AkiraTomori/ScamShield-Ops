const countFormat = new Intl.NumberFormat("vi-VN");

/** Counter text such as `0/2.000`. Counting itself follows the server rules (U-02), not this file. */
export function formatCharCount(count: number, max: number): string {
  return `${countFormat.format(count)}/${countFormat.format(max)}`;
}

/** ARIA wiring of a text field with an optional counter and error message. */
export function fieldAria({
  counterId,
  errorId,
  hasError,
}: {
  counterId?: string;
  errorId: string;
  hasError: boolean;
}) {
  const describedBy = [hasError ? errorId : undefined, counterId].filter(Boolean).join(" ");
  return {
    "aria-invalid": hasError,
    "aria-describedby": describedBy || undefined,
  };
}
