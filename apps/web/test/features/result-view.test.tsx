import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "@scamshield/shared";
import { vi } from "../../src/copy/vi";
import { FIXTURES } from "../../src/features/analysis/fixtures";
import { ResultView } from "../../src/features/analysis/ResultView";

// U-06: static markup over every fixture, for invariants only.
const render = (result: AnalysisResult) =>
  renderToStaticMarkup(<ResultView result={result} actions={null} onRetry={() => {}} />);

const cases = FIXTURES.map((f) => [f.name, f.result] as const);

/** The `<section>` under a heading, or "" when the block has none. */
const section = (html: string, heading: string) =>
  html.split("<section").find((part) => part.includes(`>${heading}</h3>`)) ?? "";

describe("result block", () => {
  it.each(cases)("SO-03-AC03, AC04: %s has no 'an toàn' and no percentage", (_, result) => {
    const html = render(result).toLowerCase();
    expect(html).not.toContain("an toàn");
    expect(html).not.toContain("%");
  });

  it.each(cases)("P5: %s has nothing to click through to or load", (_, result) => {
    expect(render(result)).not.toMatch(/<(a|img|iframe|object|embed)\b|href=|src=/i);
  });

  it.each(cases)("%s reads in the order of ui-pages §2.3", (_, result) => {
    const html = render(result);
    const headings = [
      vi.verdict[result.verdict].label,
      vi.result.explanationHeading,
      vi.result.signalsHeading,
      vi.result.indicatorsHeading,
      vi.result.recommendationsHeading,
      vi.disclaimer,
    ];
    // Only the explanation may be missing.
    const expected = headings.filter(
      (text) => result.explanation !== null || text !== vi.result.explanationHeading,
    );
    const found = expected.map((text) => html.indexOf(`>${text}<`));
    expect(found).not.toContain(-1);
    expect(found).toEqual([...found].sort((a, b) => a - b));
    expect(html).toContain(`>${vi.verdict[result.verdict].label}</h2>`);
    expect(html).toContain(vi.disclaimer);
  });

  it.each(cases)("SO-05-AC03: %s marks the AI text and never the advice", (_, result) => {
    const html = render(result);
    const why = section(html, vi.result.explanationHeading);
    if (result.explanation === null) {
      expect(why).toBe("");
    } else {
      expect(why).toContain(vi.signalSource.ai);
      expect(why).toContain(result.explanation);
    }
    const advice = section(html, vi.result.recommendationsHeading);
    expect(advice).toContain("<ol");
    expect(advice).not.toContain(vi.signalSource.ai);
    for (const line of result.recommendations) expect(advice).toContain(line);
  });

  // ui-pages §2.3: sections 4 and 5 stay, and say so when there is nothing to list.
  const NO_SIGNALS = "Chưa phát hiện tín hiệu nào";
  const NO_INDICATORS = "Không tìm thấy đường dẫn, số điện thoại hay số tài khoản";

  const expectListOrSentence = (part: string, empty: boolean, sentence: string) => {
    expect(part).not.toBe("");
    expect(part.includes(`>${sentence}</p>`)).toBe(empty);
    if (empty) expect(part).not.toContain("<ul");
  };

  it.each(cases)("SO-02-AC04: %s lists signals and indicators, or says none", (_, result) => {
    const html = render(result);
    expectListOrSentence(
      section(html, vi.result.signalsHeading),
      result.signals.length === 0,
      NO_SIGNALS,
    );
    const cards = result.indicators.filter((i) => i.type !== "brand");
    expectListOrSentence(
      section(html, vi.result.indicatorsHeading),
      cards.length === 0,
      NO_INDICATORS,
    );
    for (const { value } of cards) expect(html).toContain(`>${value}<`);
  });

  it("SO-02-AC04: says no indicator was found when the message only names a brand", () => {
    const brandOnly = {
      type: "brand" as const,
      value: "Ví XYZ",
      normalized: "vi-xyz",
      checks: [],
    };
    const html = render({ ...FIXTURES[0]!.result, indicators: [brandOnly] });
    expectListOrSentence(section(html, vi.result.indicatorsHeading), true, NO_INDICATORS);
  });

  it.each(cases)("SO-03-AC06: %s offers a retry only when it can help", (_, result) => {
    const retry =
      result.verdict === "inconclusive" && result.inconclusiveReason !== "insufficient_evidence";
    expect(render(result).includes(`>${vi.retry}</button>`)).toBe(retry);
  });
});
