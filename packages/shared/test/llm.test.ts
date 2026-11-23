import { describe, expect, it } from "vitest";
import {
  AiSignalType,
  LlmExplanationOutput,
  LlmSignalOutput,
  LlmSignalRawOutput,
  SignalType,
} from "../src";

describe("LLM schemas (contracts §7)", () => {
  it("AiSignalType is exactly the AI-sourced subset of SignalType", () => {
    expect(AiSignalType.options).toEqual([
      "claims_organization",
      "urgency",
      "threat",
      "credential_request",
      "payment_request",
      "reward_promise",
      "ai_directed_instruction",
    ]);
    for (const type of AiSignalType.options) expect(SignalType.options).toContain(type);
    expect(AiSignalType.safeParse("brand_domain_mismatch").success).toBe(false);
  });

  it("the wire schema tolerates unknown types and a missing brand list", () => {
    const parsed = LlmSignalRawOutput.safeParse({ signals: [{ type: "weird", evidence: "x" }] });
    expect(parsed.success && parsed.data.mentionedBrands).toEqual([]);
  });

  it("the contract schema rejects unknown types", () => {
    expect(
      LlmSignalOutput.safeParse({
        signals: [{ type: "weird", evidence: "x" }],
        mentionedBrands: [],
      }).success,
    ).toBe(false);
  });

  it("explanation must be non-empty and the object has no verdict field", () => {
    expect(LlmExplanationOutput.safeParse({ explanation: "" }).success).toBe(false);
    expect(LlmExplanationOutput.safeParse({ explanation: "ok" }).success).toBe(true);
    expect(Object.keys(LlmExplanationOutput.shape)).toEqual(["explanation"]);
  });
});
