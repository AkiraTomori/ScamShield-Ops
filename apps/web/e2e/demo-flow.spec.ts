import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { vi } from "../src/copy/vi";

// The six steps of plan §1 (demo-data §4). The verdict itself is not asserted (DM-02): it depends on
// the real model, and its accuracy is measured by eval.

// The one source of the demo texts (demo-data §2), read as the file it is.
const messages = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../packages/shared/data/demo-messages.json"), "utf8"),
) as { id: string; chip: string | null; content: string }[];

const SCAM_DOMAIN = "vi-xac-minh.example";
const NOTE = "Kiểm thử E2E";
const REASON = "Kiểm thử E2E: chưa đủ bằng chứng để kết luận.";

/**
 * Signs in `judge1`. Typing before React has taken over the field is lost, so this retries. Once the
 * sign-in has gone through, the list may still take a while: the form is then read only or gone, and
 * is left alone.
 */
async function signIn(page: Page, password: string): Promise<void> {
  const username = page.getByLabel(vi.ops.login.username);
  const short = { timeout: 2_000 };
  await expect(async () => {
    if ((await username.isVisible()) && (await username.isEditable(short))) {
      await username.fill("judge1", short);
      await page.getByLabel(vi.ops.login.password).fill(password, short);
      await page.getByRole("button", { name: vi.ops.login.submit }).click(short);
    }
    await expect(page.getByRole("form", { name: vi.ops.list.filtersLabel })).toBeVisible({
      timeout: 5_000,
    });
  }).toPass({ intervals: [2_000], timeout: 40_000 });
}

test("SO-10-AC01: check, report, then conclude the case in FraudOps", async ({ page, browser }) => {
  const m1 = messages.find((m) => m.id === "M1");
  if (!m1?.chip) throw new Error("demo-messages.json has no M1 chip");
  const password = process.env.E2E_JUDGE_PASSWORD;
  if (!password) throw new Error("Set E2E_JUDGE_PASSWORD to the password of judge1.");

  const caseCode = await test.step("1–2: check the sample message on a phone", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const box = page.getByLabel(vi.analysis.inputLabel);
    // The server renders the chip before React can answer it.
    await expect(async () => {
      await page.getByRole("button", { name: m1.chip ?? "" }).click();
      await expect(box).toHaveValue(m1.content, { timeout: 500 });
    }).toPass();
    await page.getByRole("button", { name: vi.analysis.submit, exact: true }).click();
    await expect(page.getByRole("button", { name: vi.analysis.submitting })).toBeVisible();

    const verdicts = Object.values(vi.verdict).map((v) => v.label);
    await expect(
      page.getByRole("heading", { level: 2, name: new RegExp(`^(${verdicts.join("|")})$`) }),
    ).toBeVisible({ timeout: 25_000 });

    const badges = Object.values(vi.signalSource).join("|");
    await expect(
      page
        .getByRole("region", { name: vi.result.signalsHeading })
        .getByText(new RegExp(`^(${badges})$`))
        .first(),
    ).toBeVisible();
    await expect(page.getByText(vi.disclaimer).first()).toBeVisible();
    // P5: what the message contained is shown as text, never as a link.
    await expect(page.locator(`a[href*="${SCAM_DOMAIN}"]`)).toHaveCount(0);
    await expect(page.locator("a", { hasText: SCAM_DOMAIN })).toHaveCount(0);

    // 3: report it.
    return test.step("3: send the report", async () => {
      await page.getByRole("button", { name: vi.report.open }).click();
      await page.getByRole("radio", { name: vi.report.channel.sms }).check();
      await page.getByLabel(vi.report.noteLabel).fill(NOTE);
      await page.getByRole("button", { name: vi.report.submit, exact: true }).click();
      await expect(page.getByRole("heading", { name: vi.report.sent })).toBeVisible({
        timeout: 30_000,
      });

      const codes = page.locator("code");
      await expect(codes).toHaveCount(2);
      await expect(codes.nth(0)).toHaveText(/^SC-\d{4,}$/);
      await expect(codes.nth(1)).not.toBeEmpty();
      return codes.nth(0).innerText();
    });
  });

  const staff = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 1280, height: 800 },
  });
  const ops = await staff.newPage();
  // The conclusion block: related cases show the same words.
  const conclusion = ops.getByRole("region", { name: vi.ops.decision.heading });

  await test.step("4: sign in to FraudOps", async () => {
    await ops.goto("/ops");
    await signIn(ops, password);
  });

  await test.step("5: find the case and conclude it", async () => {
    await ops.getByLabel(vi.ops.list.codeLabel).fill(caseCode);
    await ops.getByRole("button", { name: vi.ops.list.apply }).click();
    await ops.getByRole("link", { name: caseCode }).click();
    await expect(ops.getByRole("heading", { level: 1, name: caseCode })).toBeVisible();

    // Not "confirmed_scam": that would put the demo domain on the confirmed list (demo-data §4).
    await ops.getByRole("radio", { name: vi.ops.list.decision.insufficient_evidence }).check();
    await ops.getByLabel(vi.ops.decision.reasonLabel).fill(REASON);
    await ops.getByRole("button", { name: vi.ops.decision.submit }).click();
    await expect(conclusion.getByText(`${vi.ops.decision.reason}: ${REASON}`)).toBeVisible();
  });

  await test.step("6: the conclusion is still there after a reload", async () => {
    await ops.reload();
    await expect(ops.getByText(vi.ops.list.status.closed, { exact: true })).toBeVisible();
    await expect(conclusion.getByText(`${vi.ops.decision.reason}: ${REASON}`)).toBeVisible();
    await expect(
      conclusion.getByText(vi.ops.list.decision.insufficient_evidence, { exact: true }),
    ).toBeVisible();
  });

  await staff.close();
});
