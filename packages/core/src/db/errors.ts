/**
 * True when `error` is the violation of this unique constraint. drizzle wraps driver errors, so the
 * Postgres fields sit somewhere along the `cause` chain.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  let current = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    const { code, constraint_name } = current as Error & {
      code?: string;
      constraint_name?: string;
    };
    if (code === "23505") return constraint_name === constraint;
    current = current.cause;
  }
  return false;
}
