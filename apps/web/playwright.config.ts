import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { defineConfig } from "@playwright/test";
import { resolveE2eEnv } from "./e2e/env";

// The demo flow (T-092, demo-data §4). Run by hand with `npm run test:e2e`, never in CI: it needs a
// database and calls the real model about three times.
const PORT = 3100;

function readEnvFile(name: string): Record<string, string | undefined> {
  try {
    return parseEnv(readFileSync(path.resolve(__dirname, "../..", name), "utf8"));
  } catch {
    return {};
  }
}

const { deployed, env } = resolveE2eEnv(process.env, readEnvFile(".env"), readEnvFile(".env.e2e"));
for (const [name, value] of Object.entries(env)) process.env[name] = value;

const baseURL = deployed || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  // Each run costs model calls and creates a case: never repeat on its own.
  retries: 0,
  timeout: 120_000,
  reporter: "list",
  // A failure can leave the report's secret code on screen, and Playwright then saves it, as a
  // screenshot and as page text in `error-context.md`. Against a deployed site nothing is kept.
  preserveOutput: deployed ? "never" : "always",
  // No trace: it would record the staff password and the secret code.
  use: { baseURL, trace: "off", screenshot: deployed ? "off" : "only-on-failure" },
  webServer: deployed
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: baseURL,
        // A server already on this port may use another database.
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
