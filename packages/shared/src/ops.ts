import { z } from "zod";

// Shapes of the FraudOps routes (api.md §4). Browser-safe.

export const LOGIN_USERNAME_MAX_CHARS = 64;
export const LOGIN_PASSWORD_MAX_CHARS = 200;

export const LoginRequest = z
  .object({
    username: z.string().trim().toLowerCase().min(1).max(LOGIN_USERNAME_MAX_CHARS),
    /** Taken as typed: no trimming, no case folding. */
    password: z.string().min(1).max(LOGIN_PASSWORD_MAX_CHARS),
  })
  .strict();
export type LoginRequest = z.infer<typeof LoginRequest>;
