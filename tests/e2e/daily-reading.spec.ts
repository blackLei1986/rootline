import { expect, test } from "@playwright/test";

const dailyReadingReady = Boolean(
  process.env.E2E_SUPABASE_READY
  && process.env.E2E_DAILY_READING_STORAGE_STATE
  && process.env.E2E_DAILY_READING_ARTICLE_ID
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

test("Daily-3 completion survives reload without emitting Today learning events", async ({ page }) => {
  test.skip(!dailyReadingReady, "Requires E2E_SUPABASE_READY, a verified local-user storage state, and a seeded frozen Daily-3 article ID.");

  const todayEventRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/today/events")) todayEventRequests.push(request.url());
  });
  await page.goto(`/reading/daily/${process.env.E2E_DAILY_READING_ARTICLE_ID}`);
  await expect(page.getByRole("heading").nth(1)).toBeVisible();
  await page.getByRole("button", { name: "完成阅读" }).click();
  await expect(page.getByText("已完成阅读")).toBeVisible();

  await page.reload();
  await expect(page.getByText("已完成阅读")).toBeVisible();
  expect(todayEventRequests).toEqual([]);
});

test("authenticated Daily-3 article supports responsive reading and keyboard word details", async ({ page }) => {
  test.skip(!dailyReadingReady, "Requires E2E_SUPABASE_READY, a verified local-user storage state, and a seeded frozen Daily-3 article ID.");
  const articleUrl = `/reading/daily/${process.env.E2E_DAILY_READING_ARTICLE_ID}`;

  for (const width of [390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(articleUrl);
    await expect(page.getByRole("heading").nth(1)).toBeVisible();
    await expect(page.getByRole("article", { name: "文章摘要" })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow, `horizontal overflow at ${width}px`).toBe(false);
  }

  const summary = page.getByRole("article", { name: "文章摘要" });
  const word = summary.getByRole("button", { name: /今日词|近 7 日词|近期词/ }).first();
  await word.focus();
  await expect(word).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(word).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("dialog")).toBeVisible();

  const selectedText = await page.evaluate(() => {
    const paragraph = document.querySelector('[aria-label="文章摘要"] p');
    if (!paragraph?.textContent) return "";
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return selection?.toString() ?? "";
  });
  expect(selectedText).toBe(await summary.locator("p").textContent());
});
