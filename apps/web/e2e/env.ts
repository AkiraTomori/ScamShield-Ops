/**
 * Which site and database `npm run test:e2e` uses (demo-data §4). Pure, so it can be tested:
 * `playwright.config.ts` reads the files.
 */

type Vars = Record<string, string | undefined>;

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

export function resolveE2eEnv(
  shell: Vars,
  main: Vars,
  local: Vars,
): {
  /** Set: test this deployed site. It leaves one closed case behind. */
  deployed: string | undefined;
  /** What to add to the environment; the shell already wins and is left out. */
  env: Vars;
} {
  // From the shell only: a value forgotten in a file would send every later run to that site.
  const deployed = shell.E2E_BASE_URL || undefined;

  const fromMain = { ...main };
  delete fromMain.E2E_BASE_URL;
  // A local run has its own database in .env.e2e. The one in .env is never used: it may well be the
  // deployed database.
  if (!deployed) {
    delete fromMain.DATABASE_URL;
    delete fromMain.DATABASE_URL_MIGRATE;
  }
  const merged: Vars = { ...fromMain, ...(deployed ? {} : local) };
  delete merged.E2E_BASE_URL;
  const env = Object.fromEntries(
    Object.entries(merged).filter(([name]) => shell[name] === undefined),
  );

  // The local run writes a case and a conclusion, so it refuses any database not on this machine.
  if (!deployed) {
    const url = shell.DATABASE_URL ?? env.DATABASE_URL;
    const host = url && URL.canParse(url) ? new URL(url).hostname : "";
    if (!LOCAL_HOSTS.includes(host)) {
      // Never echo the value: it holds a password.
      throw new Error(
        "test:e2e needs a local Postgres in .env.e2e: run `npm run e2e:setup` first.",
      );
    }
  }
  return { deployed, env };
}
