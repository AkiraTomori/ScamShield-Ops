import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { MatchableIndicatorType } from "@scamshield/shared";
import { analyses } from "../../src/db/schema";
import { allWithin, oneOf } from "../../src/db/schema/checks";

const dialect = new PgDialect();

describe("CHECK literal helpers", () => {
  it("renders an IN list of quoted literals", () => {
    const { sql: text } = dialect.sqlToQuery(oneOf(analyses.verdict, ["a_b", "c"]));
    expect(text).toBe(`"analyses"."verdict" IN ('a_b', 'c')`);
  });

  it("renders an array-containment check", () => {
    const { sql: text } = dialect.sqlToQuery(allWithin(analyses.riskTypes, ["x", "y"]));
    expect(text).toBe(`"analyses"."risk_types" <@ ARRAY['x', 'y']::text[]`);
  });

  it("refuses a value that is not a safe SQL literal instead of escaping it", () => {
    expect(() => oneOf(analyses.verdict, ["ok", "it's"])).toThrow(/safe SQL literal/);
  });

  it("limits stored indicator types to the ones SO-07-AC01 matches on", () => {
    expect(MatchableIndicatorType.options).toEqual(["domain", "phone", "bank_account"]);
  });
});
