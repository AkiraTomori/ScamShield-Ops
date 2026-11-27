import { describe, expect, it } from "vitest";
import { DEMO_MESSAGES, normalizeInput } from "../src";

const chips = DEMO_MESSAGES.filter((message) => message.chip !== null);

describe("demo messages (SO-10-AC05)", () => {
  it("offers the four chips of demo-data §2", () => {
    expect(chips.map((m) => [m.id, m.chip])).toEqual([
      ["M1", "Khoá tài khoản"],
      ["M2", "Tin OTP thật"],
      ["prize", "Trúng thưởng"],
      ["urgent", "Chuyển tiền gấp"],
    ]);
  });

  it("can all be submitted as they are", () => {
    for (const { content } of DEMO_MESSAGES) expect(normalizeInput(content).ok).toBe(true);
  });

  it("uses only reserved domains and never says 'an toàn'", () => {
    for (const { content } of DEMO_MESSAGES) {
      expect(content.toLowerCase()).not.toContain("an toàn");
      for (const [host] of content.matchAll(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi)) {
        expect(host).toMatch(/\.(example|test)$/);
      }
    }
  });
});
