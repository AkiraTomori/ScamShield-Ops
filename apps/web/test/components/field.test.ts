import { describe, expect, it } from "vitest";
import { fieldAria, formatCharCount } from "../../src/components/field";

describe("text field helpers", () => {
  it("SO-01-AC02: shows the count in Vietnamese number format", () => {
    expect(formatCharCount(0, 2000)).toBe("0/2.000");
    expect(formatCharCount(2001, 2000)).toBe("2.001/2.000");
  });

  it("SO-01-AC02: links the counter, and the error only when there is one", () => {
    expect(fieldAria({ counterId: "c", errorId: "e", hasError: false })).toEqual({
      "aria-invalid": false,
      "aria-describedby": "c",
    });
    expect(fieldAria({ counterId: "c", errorId: "e", hasError: true })).toEqual({
      "aria-invalid": true,
      "aria-describedby": "e c",
    });
    expect(fieldAria({ errorId: "e", hasError: false })).toEqual({
      "aria-invalid": false,
      "aria-describedby": undefined,
    });
  });
});
