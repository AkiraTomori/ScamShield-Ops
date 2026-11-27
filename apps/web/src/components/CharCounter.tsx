import { formatCharCount } from "./field";

export function CharCounter({ id, count, max }: { id: string; count: number; max: number }) {
  return (
    <p id={id} className={`text-sm ${count > max ? "text-danger" : "text-text-muted"}`}>
      {formatCharCount(count, max)}
    </p>
  );
}
