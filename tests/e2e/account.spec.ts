import { expect, test } from "@playwright/test";

test("account entry points preserve the intended destination", async ({ page }) => {
  await page.goto("/login?next=%2Ftoday");
  await expect(page.getByRole("heading", { name: "继续你的学习" })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page).toHaveURL(/next=%2Ftoday/);
  await page.goto("/register?next=%2Ftoday");
  await expect(page.getByRole("heading", { name: /创建/ })).toBeVisible();
});

test("register, verify, login, logout, and reset", async () => {
  test.skip(!process.env.E2E_SUPABASE_READY, "Requires two verified local Supabase test users.");
});
