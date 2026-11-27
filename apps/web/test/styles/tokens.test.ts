import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { compile } from "tailwindcss";
import { beforeAll, describe, expect, it } from "vitest";

const GLOBALS = path.resolve(import.meta.dirname, "../../src/styles/globals.css");
const require = createRequire(import.meta.url);

// docs/product/design-system.md §2.
const COLORS = {
  bg: "#ffffff",
  "surface-subtle": "#f2f4f7",
  text: "#101828",
  "text-muted": "#475467",
  border: "#d0d5dd",
  "border-strong": "#667085",
  primary: "#3538cd",
  danger: "#b42318",
  "verdict-high-risk": "#b42318",
  "verdict-high-risk-bg": "#fef3f2",
  "verdict-suspicious": "#b54708",
  "verdict-suspicious-bg": "#fffaeb",
  "verdict-no-signal": "#175cd3",
  "verdict-no-signal-bg": "#eff8ff",
  "verdict-inconclusive": "#344054",
  "verdict-inconclusive-bg": "#f2f4f7",
  "source-check": "#0e7090",
  "source-check-bg": "#ecfdff",
  "source-ai": "#6941c6",
  "source-ai-bg": "#f4f3ff",
};

let build: (candidates: string[]) => string;

beforeAll(async () => {
  const compiler = await compile(await readFile(GLOBALS, "utf8"), {
    base: path.dirname(GLOBALS),
    loadStylesheet: async (id) => {
      const file = require.resolve(id === "tailwindcss" ? "tailwindcss/index.css" : id);
      return { path: file, base: path.dirname(file), content: await readFile(file, "utf8") };
    },
  });
  build = (candidates) => compiler.build(candidates).toLowerCase();
});

describe("design tokens (design-system §2)", () => {
  it("declares every colour token with the documented value", () => {
    const css = build([]);
    for (const [name, value] of Object.entries(COLORS)) {
      expect(css).toContain(`--color-${name}: ${value};`);
    }
  });

  it("offers no colour outside the tokens, so no verdict can be painted green", () => {
    const css = build(["bg-green-500", "text-emerald-700", "bg-red-500", "bg-primary"]);
    expect(css).toContain(".bg-primary");
    expect(css).not.toMatch(/\.(bg-green-500|text-emerald-700|bg-red-500)\b/);
  });

  it("has the five text sizes and the two corner radii", () => {
    const css = build([
      "text-xs",
      "text-sm",
      "text-md",
      "text-lg",
      "text-xl",
      "rounded-control",
      "rounded-card",
      "p-1",
    ]);
    const sizes = [
      ["xs", 12, 16],
      ["sm", 14, 20],
      ["md", 16, 24],
      ["lg", 20, 28],
      ["xl", 24, 32],
    ] as const;
    for (const [name, size, line] of sizes) {
      expect(css).toContain(`--text-${name}: ${size / 16}rem;`);
      expect(css).toContain(`--text-${name}--line-height: ${line / 16}rem;`);
      expect(css).toContain(`.text-${name} {`);
    }
    expect(css).toContain("--radius-control: 6px;");
    expect(css).toContain("--radius-card: 10px;");
    expect(css).toContain("--spacing: 0.25rem;"); // 4px scale
  });
});
