import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CaseFileError, EvalCase, parseCaseFile } from "../src/case";

const good = {
  id: "dev-001",
  group: "clear_scam",
  content: "[Ví XYZ] Xác minh tại vi-xac-minh.example",
  expectedVerdicts: ["high_risk"],
  expectedSignals: ["brand_domain_mismatch", "urgency"],
  forbiddenSignals: [],
  notes: "x",
};
const line = (o: unknown) => JSON.stringify(o);

describe("EvalCase", () => {
  it("accepts the research B.2 example shape", () => {
    expect(EvalCase.safeParse(good).success).toBe(true);
  });

  it.each([
    ["unknown group", { ...good, group: "other" }],
    ["unknown signal name", { ...good, expectedSignals: ["made_up"] }],
    ["no expected verdict", { ...good, expectedVerdicts: [] }],
    ["unknown verdict", { ...good, expectedVerdicts: ["safe"] }],
    ["empty content", { ...good, content: "" }],
    ["extra field", { ...good, score: 1 }],
    ["bad id", { ...good, id: "1" }],
    ["signal both expected and forbidden", { ...good, forbiddenSignals: ["urgency"] }],
  ])("rejects %s", (_name, value) => {
    expect(EvalCase.safeParse(value).success).toBe(false);
  });
});

describe("parseCaseFile", () => {
  it("parses JSONL and skips blank lines", () => {
    expect(parseCaseFile(`${line(good)}\n\n${line({ ...good, id: "dev-002" })}\n`)).toHaveLength(2);
  });

  it("stops on a bad line and says which", () => {
    expect(() => parseCaseFile(`${line(good)}\n{oops`)).toThrow(/line 2/);
    expect(() => parseCaseFile(`${line({ ...good, group: "x" })}`)).toThrow(CaseFileError);
  });

  it("rejects duplicate ids", () => {
    expect(() => parseCaseFile(`${line(good)}\n${line(good)}`)).toThrow(/duplicate/);
  });
});

describe("SO-09-AC01 / T-020: eval/cases/dev.jsonl", () => {
  const cases = parseCaseFile(
    readFileSync(resolve(import.meta.dirname, "../cases/dev.jsonl"), "utf8"),
  );

  it("has 20 cases in the research A.3 mix (8 / 5 / 4 / 3)", () => {
    const count = (g: string) => cases.filter((c) => c.group === g).length;
    expect(cases).toHaveLength(20);
    expect([
      count("clear_scam"),
      count("legit_lookalike"),
      count("ambiguous"),
      count("prompt_injection"),
    ]).toEqual([8, 5, 4, 3]);
  });

  it("uses only reserved example domains and no real-looking URLs", () => {
    const hosts = cases.flatMap((c) =>
      [...c.content.matchAll(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/\S*)?/gi)].map((m) =>
        (m[1] ?? "").toLowerCase(),
      ),
    );
    for (const host of hosts) expect(host).toMatch(/\.(example|test)$/);
  });
});
