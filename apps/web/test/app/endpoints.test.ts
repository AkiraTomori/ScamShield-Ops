import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// P1: the app can only do what api.md §2 lists. A new route without a line there fails here, which
// puts it in front of the owner: nothing may lock an account, block a payment or contact a third party.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const API_DIR = path.join(root, "apps/web/src/app/api");

/** `[code]` and `{caseCode}` are the same hole in a path. */
const endpoint = (method: string, route: string) =>
  `${method} ${route.replace(/\[[^\]]+\]|\{[^}]+\}/g, "{}")}`;

function implemented(): string[] {
  return readdirSync(API_DIR, { recursive: true, encoding: "utf8" })
    .filter((file) => path.basename(file) === "route.ts")
    .flatMap((file) => {
      const source = readFileSync(path.join(API_DIR, file), "utf8");
      const methods = [
        ...source.matchAll(
          /export\s+(?:async\s+)?(?:function|const)\s+(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/g,
        ),
      ].map((match) => match[1]!);
      expect(methods.length, `${file} exports no method this test can read`).toBeGreaterThan(0);
      const route = `/api/${path.dirname(file).split(path.sep).join("/")}`;
      return methods.map((method) => endpoint(method, route));
    });
}

function documented(): string[] {
  const doc = readFileSync(path.join(root, "docs/architecture/api.md"), "utf8");
  const table = doc.split("## 2. ")[1]!.split("## 3. ")[0]!;
  return [...table.matchAll(/^\| `(\w+)` \| `([^`]+)` \|/gm)].map((m) => endpoint(m[1]!, m[2]!));
}

describe("API surface", () => {
  it("SO-06-AC06: has no endpoint beyond the table in api.md §2", () => {
    const code = implemented();
    expect(code).toContain("POST /api/ops/cases/{}/decision");
    expect(code.length).toBeGreaterThanOrEqual(7);
    expect(code.filter((e) => !documented().includes(e))).toEqual([]);
  });
});
