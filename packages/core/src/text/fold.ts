/** Matching helpers: compare without case or diacritics while keeping positions in the original. */

export interface Span {
  start: number;
  end: number;
}

export interface Folded {
  text: string;
  /** Original index of a position in `text` (also accepts `text.length`). */
  at: (foldedIndex: number) => number;
}

export function fold(original: string): Folded {
  let text = "";
  const map: number[] = [];
  let index = 0;
  for (const char of original) {
    const folded = char.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
    for (let i = 0; i < folded.length; i++) map.push(index);
    text += folded;
    index += char.length;
  }
  return { text, at: (i) => map[i] ?? original.length };
}

export function overlaps(span: Span, others: readonly Span[]): boolean {
  return others.some((o) => span.start < o.end && o.start < span.end);
}
