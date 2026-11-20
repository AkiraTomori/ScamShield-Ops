import path from "node:path";
import type { NextConfig } from "next";

// One root .env for the whole repo (Next only reads apps/web/.env* by itself). Variables already
// present in the environment win, and a missing file is fine: Vercel and CI have none.
try {
  process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
} catch {
  // no .env file
}

const nextConfig: NextConfig = {
  transpilePackages: ["@scamshield/core", "@scamshield/shared"],
};

export default nextConfig;
