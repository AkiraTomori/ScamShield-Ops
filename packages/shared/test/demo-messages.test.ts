import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("holds M1, M2, M3, prize and urgent; M3 is pasted by hand, not offered", () => {
    expect(DEMO_MESSAGES.map((m) => m.id).sort()).toEqual(["M1", "M2", "M3", "prize", "urgent"]);
    expect(DEMO_MESSAGES.find((m) => m.id === "M3")?.chip).toBeNull();
  });

  it("R-01, SO-07: M1 and M3 are different texts with the same domain and brand", () => {
    const [m1, m3] = ["M1", "M3"].map((id) => DEMO_MESSAGES.find((m) => m.id === id)?.content);
    expect(m1).not.toBe(m3);
    for (const content of [m1, m3]) {
      expect(content).toContain("vi-xac-minh.example");
      expect(content).toContain("Vietcombank");
    }
  });

  // demo-data §2: they are public on the page, so they must never be measured as unseen.
  it("keeps every demo message out of the held-out set", () => {
    const heldout = resolve(import.meta.dirname, "../../../eval/cases/heldout.jsonl");
    const text = existsSync(heldout) ? readFileSync(heldout, "utf8") : "";
    for (const { content } of DEMO_MESSAGES) expect(text).not.toContain(content);
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
