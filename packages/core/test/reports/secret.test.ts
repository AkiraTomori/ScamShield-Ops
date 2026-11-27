import { describe, expect, it } from "vitest";
import {
  formatSecretCode,
  generateSecretCode,
  hashSecret,
  normalizeSecretCode,
  verifySecret,
} from "../../src/reports";

describe("secret code", () => {
  it("RP-05: is 8 characters of the Crockford alphabet", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSecretCode()).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    }
    expect(generateSecretCode(() => 31)).toBe("ZZZZZZZZ");
    expect(generateSecretCode(() => 0)).toBe("00000000");
  });

  it("is shown in two groups of four", () => {
    expect(formatSecretCode("K7QX2M9P")).toBe("K7QX-2M9P");
  });

  it("forgives how a code is typed back from paper", () => {
    expect(normalizeSecretCode("  k7qx-2m9p ")).toBe("K7QX2M9P");
    expect(normalizeSecretCode("olio 0000")).toBe("01100000");
    expect(normalizeSecretCode("K7QX - 2M9P")).toBe("K7QX2M9P");
  });

  it.each(["", "K7QX2M9", "K7QX2M9PA", "K7QX2M9U", "K7QX2M9!"])("rejects %j", (input) => {
    expect(normalizeSecretCode(input)).toBeNull();
  });

  it("SO-04-AC04: verifies the right code only, and never stores the code", async () => {
    const hash = await hashSecret("K7QX2M9P");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[^$]+\$[^$]+$/);
    expect(hash).not.toContain("K7QX2M9P");
    expect(await hashSecret("K7QX2M9P")).not.toBe(hash); // salted
    expect(await verifySecret("K7QX2M9P", hash)).toBe(true);
    expect(await verifySecret("K7QX2M9Q", hash)).toBe(false);
    expect(await verifySecret("K7QX2M9P", "scrypt$test$hash")).toBe(false);
  });
});
