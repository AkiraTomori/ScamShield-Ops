import { BRANDS, URL_LISTS } from "@scamshield/shared";
import { describe, expect, it } from "vitest";
import { selectIndicatorsToConfirm } from "../../src/confirmed-indicators/select";
import { extractIndicators, UNMATCHED_DOMAINS } from "../../src/indicators";

describe("selectIndicatorsToConfirm (verified-indicators §2)", () => {
  const select = (indicators: Parameters<typeof selectIndicatorsToConfirm>[0]) =>
    selectIndicatorsToConfirm(indicators, UNMATCHED_DOMAINS);

  it("SO-08-AC01: keeps domains, phone numbers and bank accounts", () => {
    const indicators = [
      { type: "domain", normalized: "vi-xac-minh.example" },
      { type: "phone", normalized: "0900000001" },
      { type: "bank_account", normalized: "0123456789" },
    ] as const;
    expect(select([...indicators])).toEqual([indicators[2], indicators[0], indicators[1]]);
  });

  it("XM-01: never takes a domain of the brand list or of a URL shortener", () => {
    const excluded = [
      ...BRANDS.flatMap((brand) => brand.domains),
      ...URL_LISTS.shorteners.map((entry) => entry.value),
    ];
    expect(select(excluded.map((normalized) => ({ type: "domain", normalized })))).toEqual([]);
  });

  it("XM-01: the domain the pipeline extracts from such a link is excluded too", () => {
    const excluded = [
      ...BRANDS.flatMap((brand) => brand.domains.flatMap((d) => [d, `dang-nhap.${d}`])),
      ...URL_LISTS.shorteners.map((entry) => entry.value),
    ];
    const taken = excluded.flatMap((host) => {
      const { indicators } = extractIndicators(`Xem https://${host}/a`, BRANDS);
      return select(
        indicators.flatMap((i) =>
          i.type === "domain" ? [{ type: i.type, normalized: i.normalized }] : [],
        ),
      );
    });
    expect(taken).toEqual([]);
  });

  it("XM-04: takes no domain from a link to a shared platform", () => {
    const links = [
      ...URL_LISTS.sharedPlatforms.map((entry) => `https://${entry.value}/a`),
      "https://docs.google.com/forms/d/abc",
      "https://m.facebook.com/trang.gia",
      "t.me/ho_tro_gia",
      "zalo.me/0900000001",
    ];
    for (const link of links) {
      const { indicators } = extractIndicators(`Xem ${link}`, BRANDS);
      const domains = indicators.flatMap((i) =>
        i.type === "domain" ? [{ type: i.type, normalized: i.normalized }] : [],
      );
      // A link the extractor finds no domain in would make this pass for the wrong reason.
      expect(domains, link).toHaveLength(1);
      expect(select(domains), link).toEqual([]);
    }
  });

  it("XM-04: keeps a tenant's own domain on a hosting platform", () => {
    const { indicators } = extractIndicators("Xem https://nhan-qua.pages.dev/a", BRANDS);
    const domain = { type: "domain", normalized: "nhan-qua.pages.dev" } as const;
    expect(indicators).toContainEqual(expect.objectContaining(domain));
    expect(select([domain])).toEqual([domain]);
  });

  it("excludes domains only: the same text as a number is kept", () => {
    const phone = { type: "phone", normalized: "0900000001" } as const;
    expect(selectIndicatorsToConfirm([phone], ["0900000001"])).toEqual([phone]);
  });

  it("lists each indicator once, in a stable order", () => {
    const a = { type: "domain", normalized: "a.example" } as const;
    const b = { type: "domain", normalized: "b.example" } as const;
    expect(select([b, a, { ...b }])).toEqual([a, b]);
  });

  it("returns nothing for nothing", () => {
    expect(select([])).toEqual([]);
  });
});
