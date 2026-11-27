import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { CheckStatus as CheckStatusValue, SignalSource, Verdict } from "@scamshield/shared";
import { Button } from "../../src/components/Button";
import { CharCounter } from "../../src/components/CharCounter";
import { CheckStatus } from "../../src/components/CheckStatus";
import { Disclaimer } from "../../src/components/Disclaimer";
import { ErrorState } from "../../src/components/ErrorState";
import { Skeleton } from "../../src/components/Skeleton";
import { SourceBadge } from "../../src/components/SourceBadge";
import { TextArea } from "../../src/components/TextArea";
import { VerdictBanner } from "../../src/components/VerdictBanner";
import { vi } from "../../src/copy/vi";

// U-06: static markup is used for invariants only, never to test interaction.
const everyVariant: [string, ReactElement][] = [
  ...Verdict.options.map((v): [string, ReactElement] => [v, <VerdictBanner key={v} verdict={v} />]),
  ...SignalSource.options.map((s): [string, ReactElement] => [
    s,
    <SourceBadge key={s} source={s} />,
  ]),
  ...CheckStatusValue.options.map((s): [string, ReactElement] => [
    s,
    <CheckStatus key={s} status={s} />,
  ]),
  ["button", <Button key="b">Kiểm tra</Button>],
  ["textarea", <TextArea key="t" id="t" label="Tin nhắn" error="Lỗi" />],
  ["counter", <CharCounter key="c" id="c" count={2001} max={2000} />],
  ["disclaimer", <Disclaimer key="d" />],
  ["error", <ErrorState key="e" message="Lỗi" onRetry={() => {}} />],
  ["skeleton", <Skeleton key="s" />],
];

describe("base components", () => {
  it.each(everyVariant)("SO-03-AC03, AC04, P5: %s has no 'an toàn', %% or link", (_, element) => {
    const html = renderToStaticMarkup(element).toLowerCase();
    expect(html).not.toContain("an toàn");
    expect(html).not.toContain("%");
    expect(html).not.toMatch(/<a\b|href=/);
  });

  // design-system §1: never colour alone.
  it.each(Verdict.options)("SO-03-AC03: verdict %s has an icon, its label and meaning", (v) => {
    const html = renderToStaticMarkup(<VerdictBanner verdict={v} />);
    expect(html).toContain("<svg");
    expect(html).toContain(`>${vi.verdict[v].label}</h2>`);
    expect(html).toContain(vi.verdict[v].explanation);
  });

  it.each(SignalSource.options)("SO-03-AC04: source %s has an icon and its name", (source) => {
    const html = renderToStaticMarkup(<SourceBadge source={source} />);
    expect(html).toContain("<svg");
    expect(html).toContain(vi.signalSource[source]);
  });

  it.each(CheckStatusValue.options)("SO-02-AC03: check %s has an icon and its name", (status) => {
    const html = renderToStaticMarkup(<CheckStatus status={status} />);
    expect(html).toContain("<svg");
    expect(html).toContain(vi.checkStatus[status]);
    expect(html.includes(vi.checkUnavailableNote)).toBe(status === "unavailable");
  });

  // `disabled` would drop keyboard focus to the page, so loading locks with aria-disabled instead.
  it("SO-03-AC06: a loading button says it is busy and locked, and stays focusable", () => {
    const html = renderToStaticMarkup(
      <Button loading loadingLabel="Đang kiểm tra…">
        Kiểm tra
      </Button>,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain(">Đang kiểm tra…</button>");
  });

  it("spec §9: shows the disclaimer", () => {
    expect(renderToStaticMarkup(<Disclaimer />)).toContain(vi.disclaimer);
  });
});
