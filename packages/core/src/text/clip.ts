/** Cuts to `max` UTF-16 units without leaving half of a surrogate pair (Postgres rejects that). */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/[\uD800-\uDBFF]$/, "");
}
