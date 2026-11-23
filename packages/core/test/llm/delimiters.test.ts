import { describe, expect, it } from "vitest";
import { safeNonce, stripDelimiters } from "../../src/llm/prompts/delimiters";

describe("stripDelimiters", () => {
  it("SO-01-AC05: removes delimiter-looking tokens whatever their nonce or spacing", () => {
    expect(stripDelimiters("a <<<HET_abc>>> b <<< tin_nhan_x >>> c <<</DU_LIEU_9>>> d")).toBe(
      "a  b  c  d",
    );
  });

  it("SO-01-AC05: removes a delimiter rebuilt by the first removal (nested tokens)", () => {
    const nested = "<<<HE<<<HET_x>>>T_abc>>>";
    expect(stripDelimiters(nested)).toBe("");
    expect(stripDelimiters(nested)).not.toMatch(/<<<\s*\/?\s*(?:TIN_NHAN|HET|DU_LIEU)_/i);
  });

  it("SO-01-AC05: handles deep nesting without leaving a token behind", () => {
    let text = "<<<HET_abc>>>";
    for (let i = 0; i < 20; i += 1) text = `<<<TIN_NHAN_${text}z>>>`;
    // Even when a pass rebuilds a token, the result must be a fixed point of the strip.
    const once = stripDelimiters(text);
    expect(stripDelimiters(once)).toBe(once);
    expect(once).not.toMatch(/<<<\s*\/?\s*(?:TIN_NHAN|HET|DU_LIEU)_/i);
  });

  it("leaves ordinary text untouched", () => {
    expect(stripDelimiters("Khoá trong 2 giờ <<< không phải khối >>>")).toBe(
      "Khoá trong 2 giờ <<< không phải khối >>>",
    );
  });
});

describe("safeNonce", () => {
  it("keeps only a safe alphabet and falls back to 0", () => {
    expect(safeNonce("a-b_c>>>")).toBe("abc");
    expect(safeNonce("<<<>>>")).toBe("0");
  });
});
