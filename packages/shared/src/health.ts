import { z } from "zod";

/** Why the health check could not confirm the database. Only these labels are ever logged. */
export const HealthFailureKind = z.enum(["timeout", "connect_failed", "config_missing"]);
export type HealthFailureKind = z.infer<typeof HealthFailureKind>;

const HealthCommon = {
  /** Short commit SHA on Vercel, "local" otherwise. */
  version: z.string().min(1),
  /** ISO 8601 UTC, generated per request. */
  time: z.iso.datetime(),
};

/**
 * Body of GET /api/health. Source of truth for the contract (system-design §5).
 * Never carries raw error messages, hosts, connection strings or DB user names.
 */
export const HealthResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), db: z.literal("ok"), ...HealthCommon }).strict(),
  z
    .object({ status: z.literal("degraded"), db: z.literal("unavailable"), ...HealthCommon })
    .strict(),
]);
export type HealthResponse = z.infer<typeof HealthResponse>;
