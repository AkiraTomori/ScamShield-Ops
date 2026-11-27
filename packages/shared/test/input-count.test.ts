import { describe, expect, it } from "vitest";
import { countInputChars, MAX_INPUT_CHARS, normalizeInput } from "../src";

// Built from code points so that no invisible character sits in this file.
const ch = String.fromCodePoint;
const CIRCUMFLEX = ch(0x302);
const ACUTE = ch(0x301);
const ZERO_WIDTH_SPACE = ch(0x200b);
const BYTE_ORDER_MARK = ch(0xfeff);

// The page counter and the server must agree (U-02, SO-01-AC02).
describe("countInputChars", () => {
  it("counts a decomposed Vietnamese letter as one", () => {
    expect(countInputChars(`e${CIRCUMFLEX}${ACUTE}`)).toBe(1);
  });

  it("counts an emoji as one, not as two UTF-16 units", () => {
    expect(countInputChars(`a${ch(0x1f600)}`)).toBe(2);
  });

  it("ignores zero-width characters and surrounding white space", () => {
    expect(countInputChars(`  vi${ZERO_WIDTH_SPACE}xyz${BYTE_ORDER_MARK}  \n`)).toBe(5);
    expect(countInputChars(` ${ZERO_WIDTH_SPACE} `)).toBe(0);
  });

  it("agrees with normalizeInput on both sides of the limit", () => {
    const atLimit = "a".repeat(MAX_INPUT_CHARS);
    expect(countInputChars(atLimit)).toBe(MAX_INPUT_CHARS);
    expect(normalizeInput(atLimit).ok).toBe(true);
    expect(countInputChars(`${atLimit}a`)).toBe(MAX_INPUT_CHARS + 1);
    expect(normalizeInput(`${atLimit}a`)).toEqual({ ok: false, code: "too_long" });
  });
});
