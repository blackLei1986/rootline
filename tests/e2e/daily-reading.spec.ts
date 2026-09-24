import { expect, test } from "@playwright/test";

const dailyReadingReady = Boolean(
  process.env.E2E_SUPABASE_READY === "1"
  && isLocalSupabase(process.env.E2E_SUPABASE_URL)
  && process.env.E2E_DAILY_READING_STORAGE_STATE
  && process.env.E2E_DAILY_READING_ARTICLE_ID
  && process.env.E2E_DAILY_READING_TRUSTED_WORD
  && process.env.E2E_DAILY_READING_SUPPORT_WORD
);

test("signed-out Daily-3 home remains readable at target viewport widths", async ({ page }) => {
  await page.goto("/reading");
  await expect(page.getByRole("heading", { name: "今日阅读", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "登录后查看今日阅读" })).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: "登录" })).toHaveAttribute("href", "/login?next=%2Freading");

  for (const width of [390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow, `horizontal overflow at ${width}px`).toBe(false);
  }
});

test("Daily-3 completion survives reload without emitting Today learning events", async ({ browser }) => {
  test.skip(!dailyReadingReady, "Requires E2E_SUPABASE_READY=1, local Supabase URL, verified-user storage state, a seeded frozen article, and trusted/Support match words.");
  await withAuthenticatedPage(browser, async (page) => {
    const todayEventRequests: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/today/events")) todayEventRequests.push(request.url());
    });
    const before = await readTodayProgress(page);
    await page.goto(`/reading/daily/${process.env.E2E_DAILY_READING_ARTICLE_ID}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "完成阅读" }).click();
    await expect(page.getByText("已完成阅读")).toBeVisible();

    await page.reload();
    await expect(page.getByText("已完成阅读")).toBeVisible();
    expect(todayEventRequests).toEqual([]);
    expect(await readTodayProgress(page)).toEqual(before);
  });
});

test("authenticated Daily-3 article supports responsive reading and keyboard word details", async ({ browser }) => {
  test.skip(!dailyReadingReady, "Requires E2E_SUPABASE_READY=1, a local E2E_SUPABASE_URL, verified-user storage state, and a seeded frozen article with trusted/Support match words.");
  await withAuthenticatedPage(browser, async (page) => {
    const articleUrl = `/reading/daily/${process.env.E2E_DAILY_READING_ARTICLE_ID}`;
    for (const width of [390, 430, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(articleUrl);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const summary = page.getByRole("article", { name: "文章摘要" });
      await expect(summary).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(hasHorizontalOverflow, `horizontal overflow at ${width}px`).toBe(false);

      const word = summary.getByRole("button", { name: /今日词|近 7 日词|近期词/ }).first();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      for (let index = 0; index < 20 && !(await word.evaluate((element) => element === document.activeElement)); index += 1) {
        await page.keyboard.press("Tab");
      }
      await expect(word).toBeFocused();
      await expectVisibleFocus(word);
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toBeFocused();
      await page.keyboard.press("Tab");
      const close = dialog.getByRole("button", { name: "关闭词汇详情" });
      await expect(close).toBeFocused();
      await expectVisibleFocus(close);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(word).toBeFocused();

      const prose = summary.locator("p").first();
      const box = await prose.boundingBox();
      expect(box).not.toBeNull();
      await page.mouse.move(box!.x + 2, box!.y + box!.height / 2);
      await page.mouse.down();
      await page.mouse.move(box!.x + Math.min(80, box!.width - 2), box!.y + box!.height / 2, { steps: 5 });
      await page.mouse.up();
      const selection = await page.evaluate(() => window.getSelection()?.toString() ?? "");
      expect(selection.trim().length).toBeGreaterThan(0);
    }

    for (const [wordText, hasTrustedMorphology] of [
      [process.env.E2E_DAILY_READING_TRUSTED_WORD!, true],
      [process.env.E2E_DAILY_READING_SUPPORT_WORD!, false]
    ] as const) {
      const summary = page.getByRole("article", { name: "文章摘要" });
      const button = summary.getByRole("button", { name: new RegExp(escapeRegExp(wordText)) });
      await button.focus();
      await page.keyboard.press("Space");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const morphology = dialog.getByRole("region", { name: "可信形态信息" });
      if (hasTrustedMorphology) await expect(morphology).toBeVisible();
      else await expect(morphology).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    }
  });
});

async function withAuthenticatedPage(browser: import("@playwright/test").Browser, run: (page: import("@playwright/test").Page) => Promise<void>) {
  const context = await browser.newContext({ storageState: process.env.E2E_DAILY_READING_STORAGE_STATE });
  try {
    await run(await context.newPage());
  } finally {
    await context.close();
  }
}

async function readTodayProgress(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const planResponse = await fetch("/api/today", { cache: "no-store" });
    if (!planResponse.ok) throw new Error(`Today plan request failed: ${planResponse.status}`);
    const plan = await planResponse.json() as { id: string; date: string; status: string; estimatedMinutes: number };
    const sessionResponse = await fetch(`/api/today/events?planId=${encodeURIComponent(plan.id)}`, { cache: "no-store" });
    if (!sessionResponse.ok) throw new Error(`Today session request failed: ${sessionResponse.status}`);
    const session = await sessionResponse.json() as { status: string; currentStage: string; completedQuestionIds: string[] };
    return { plan, session };
  });
}

async function expectVisibleFocus(locator: import("@playwright/test").Locator) {
  const visibleFocus = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== "none" || style.boxShadow !== "none";
  });
  expect(visibleFocus).toBe(true);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isLocalSupabase(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}
