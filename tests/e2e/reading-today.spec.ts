import { expect, test } from "@playwright/test";

test("Today follows 15 → 30 → 7 → 1 → 5 and resumes at Reading", async ({ page }) => {
  await page.goto("/today");
  await expect(page.getByText("约 22 分钟")).toBeVisible();
  await page.getByRole("button", { name: /开始今日学习/ }).click();
  await page.getByRole("button", { name: "显示答案" }).click();
  await page.getByRole("button", { name: /想起来了/ }).click();
  for (let index = 0; index < 30; index += 1) {
    await page.getByRole("button", { name: index < 7 ? "模糊" : "认识" }).click();
  }
  for (let index = 0; index < 7; index += 1) await page.getByRole("button", { name: /继续/ }).click();
  await expect(page.getByRole("heading", { name: "A useful article" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "A useful article" })).toBeVisible();
  await page.getByRole("button", { name: /完成阅读/ }).click();
  await expect(page.getByText("语境题 1 / 5")).toBeVisible();
  for (let index = 0; index < 5; index += 1) await page.getByRole("button", { name: `含义${index}` }).click();
  await expect(page.getByText("今天的最佳学习组合已完成。")).toBeVisible();
});
