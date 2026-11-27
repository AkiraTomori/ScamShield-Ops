import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import PreviewPage from "../../src/app/xem-truoc/page";
import { FIXTURES } from "../../src/features/analysis/fixtures";

afterEach(() => vi.unstubAllEnvs());

// U-04: a development page for looking at every variant of the result block.
describe("/xem-truoc", () => {
  it("shows every fixture in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const html = renderToStaticMarkup(<PreviewPage />);
    for (const { name } of FIXTURES) expect(html).toContain(name);
  });

  it("does not exist in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => PreviewPage()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
