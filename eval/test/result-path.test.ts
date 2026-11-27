import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { freeResultBase, writeNewFile } from "../src/result-path";

const NAME = { date: "2026-11-27", set: "dev", commit: "5bd4728" };
const taken =
  (...paths: string[]) =>
  (path: string) =>
    paths.includes(path);

describe("freeResultBase (eval-suite §3.3)", () => {
  it("uses <date>-<set>-<commit> when nothing is there", () => {
    expect(freeResultBase("/r", NAME, taken())).toBe("/r/2026-11-27-dev-5bd4728");
  });

  it("SO-09-AC04: numbers a later run of the same day and commit instead of reusing the name", () => {
    const first = "/r/2026-11-27-dev-5bd4728";
    expect(freeResultBase("/r", NAME, taken(`${first}.json`))).toBe(`${first}-2`);
    expect(freeResultBase("/r", NAME, taken(`${first}.json`, `${first}-2.json`))).toBe(
      `${first}-3`,
    );
  });

  it("treats a lone summary file as taken too", () => {
    const first = "/r/2026-11-27-dev-5bd4728";
    expect(freeResultBase("/r", NAME, taken(`${first}-summary.md`))).toBe(`${first}-2`);
  });
});

describe("writeNewFile", () => {
  const dir = mkdtempSync(join(tmpdir(), "eval-result-"));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("SO-09-AC04: refuses to replace a result that already exists", () => {
    const path = join(dir, "run.json");
    writeNewFile(path, "first");
    expect(() => writeNewFile(path, "second")).toThrow(/EEXIST/);
    expect(readFileSync(path, "utf8")).toBe("first");
  });
});
