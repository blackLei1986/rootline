import { expect, test } from "@playwright/test";

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

test("Daily-3 completion survives reload and leaves Today progress unchanged", async ({ page }) => {
  test.skip(!process.env.E2E_SUPABASE_READY, "Requires an authenticated local Supabase user and frozen Daily-3 article.");

  await page.goto("/today");
  const before = await readTodayProgress(page);
  await page.goto("/reading");
  await expect(page.getByRole("heading", { name: "今日阅读" })).toBeVisible();
  const firstArticle = page.getByRole("link", { name: /开始阅读/ }).first();
  await expect(firstArticle).toBeVisible();
  await firstArticle.click();
  await expect(page.getByRole("heading").nth(1)).toBeVisible();
  await page.getByRole("button", { name: "完成阅读" }).click();
  await expect(page.getByText("已完成阅读")).toBeVisible();

  await page.reload();
  await expect(page.getByText("已完成阅读")).toBeVisible();
  const after = await readTodayProgress(page);
  expect(after).toEqual(before);
});

async function readTodayProgress(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/today");
  const daily30Card = page.locator("main").first();
  await expect(daily30Card).toBeVisible();
  return (await daily30Card.innerText()).replace(/今日阅读/g, "").trim();
}
