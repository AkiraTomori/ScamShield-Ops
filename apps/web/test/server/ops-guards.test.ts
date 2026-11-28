import { describe, expect, it } from "vitest";
import { isSameOrigin, safeNextPath } from "../../src/server/ops-guards";

describe("safeNextPath", () => {
  it.each(["/ops", "/ops/ho-so/SC-0101", "/ops?trang-thai=closed&trang=2", "/ops/chi-dau"])(
    "keeps %s",
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );

  it.each([
    "//evil.example",
    "https://evil.example",
    "/\\evil.example",
    "/ops\\..\\evil",
    "/abc",
    "/opsevil",
    "/ops/../abc",
    "/ops/%2e%2e/abc",
    "ops",
    "",
    "/ops/dang-nhap",
    "/ops/dang-nhap?next=%2Fops",
  ])("sends %j to /ops", (path) => {
    expect(safeNextPath(path)).toBe("/ops");
  });

  it("sends a missing or repeated parameter to /ops", () => {
    expect(safeNextPath(undefined)).toBe("/ops");
    expect(safeNextPath(["/ops/chi-dau", "/ops"])).toBe("/ops");
  });
});

describe("isSameOrigin", () => {
  const request = (origin?: string) =>
    new Request("https://app.example/api/ops/session", {
      method: "POST",
      headers: origin ? { origin } : {},
    });

  it("accepts the app's own origin", () => {
    expect(isSameOrigin(request("https://app.example"))).toBe(true);
  });

  it.each([
    "https://evil.example",
    "http://app.example",
    "https://app.example:8443",
    "https://app.example.evil.example",
    "null",
  ])("refuses %s", (origin) => {
    expect(isSameOrigin(request(origin))).toBe(false);
  });

  it("refuses a request without Origin", () => {
    expect(isSameOrigin(request())).toBe(false);
  });

  // `next start` puts its listening address in request.url; the browser's host is in `Host`.
  const behind = (headers: Record<string, string>) =>
    new Request("http://0.0.0.0:3000/api/ops/session", { method: "POST", headers });

  it.each<Record<string, string>>([
    { origin: "http://localhost:3000", host: "localhost:3000" },
    { origin: "https://app.example", host: "app.example", "x-forwarded-proto": "https" },
    { origin: "https://app.example", host: "app.example:443", "x-forwarded-proto": "https,http" },
  ])("compares with the Host the request arrived for: %j", (headers) => {
    expect(isSameOrigin(behind(headers))).toBe(true);
  });

  it.each<Record<string, string>>([
    { origin: "http://0.0.0.0:3000", host: "localhost:3000" },
    { origin: "https://evil.example", host: "app.example", "x-forwarded-proto": "https" },
    { origin: "http://app.example", host: "app.example", "x-forwarded-proto": "https" },
    { origin: "http://app.example", host: "not a host" },
  ])("refuses a mismatch with Host: %j", (headers) => {
    expect(isSameOrigin(behind(headers))).toBe(false);
  });
});
