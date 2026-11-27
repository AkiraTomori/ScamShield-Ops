import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "**/.next/**",
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    "tools/**",
    "docs/**",
    ".claude/**",
  ]),
  {
    settings: { next: { rootDir: "apps/web" } },
    rules: {
      "react/no-danger": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "Use z.enum([...]) and an inferred type instead of a TypeScript enum.",
        },
      ],
    },
  },
  {
    // P5: user-supplied URLs are never fetched. All outbound HTTP goes through packages/core/src/http/.
    files: ["packages/core/src/**/*.{ts,tsx}", "eval/**/*.ts"],
    ignores: ["packages/core/src/http/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "Outbound HTTP must go through packages/core/src/http/ (P5).",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "globalThis",
          property: "fetch",
          message: "Outbound HTTP must go through packages/core/src/http/ (P5).",
        },
      ],
    },
  },
  {
    // Code that reaches the browser. The package root re-exports the server env and LLM schemas,
    // which would end up in the client bundle.
    files: ["apps/web/src/{components,features,copy}/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@scamshield/shared",
              allowTypeImports: true,
              message: "Import a browser entry such as @scamshield/shared/analysis.",
            },
            { name: "@scamshield/core", message: "core is server only." },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
]);
