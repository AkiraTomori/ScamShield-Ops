import { defineConfig } from "vitest/config";

// Deliberately does NOT load the root .env: unit tests must pass their env explicitly so they can
// never reach a real database by accident. Integration tests (*.int.test.ts) read DATABASE_URL
// from the process environment and skip themselves when it is absent.
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
