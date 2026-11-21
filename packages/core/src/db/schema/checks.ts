import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * DDL cannot take bound parameters, so enum lists are emitted as quoted literals. The values come
 * from the zod enums in @scamshield/shared (never from user input); a quote in one would be a
 * programming error, so it is rejected instead of escaped.
 */
function literals(values: readonly string[]): SQL {
  for (const value of values) {
    if (!/^[a-z0-9_]+$/.test(value)) {
      throw new Error(`Enum value is not a safe SQL literal: ${value}`);
    }
  }
  return sql.raw(values.map((value) => `'${value}'`).join(", "));
}

/** `column IN ('a', 'b', …)` */
export function oneOf(column: AnyPgColumn, values: readonly string[]): SQL {
  return sql`${column} IN (${literals(values)})`;
}

/** `column <@ ARRAY['a', 'b', …]::text[]`: every element of a text[] column is an allowed value. */
export function allWithin(column: AnyPgColumn, values: readonly string[]): SQL {
  return sql`${column} <@ ARRAY[${literals(values)}]::text[]`;
}
