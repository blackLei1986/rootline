import {randomUUID} from "node:crypto";
import type {Page} from "@playwright/test";
import {expect} from "@playwright/test";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/types/database";
import type {TodayPlanDTO} from "@/types/today";

export type BetaUser = {id: string; email: string; password: string};

export async function createBetaUsers(admin: SupabaseClient<Database>): Promise<[BetaUser, BetaUser]> {
  const users: BetaUser[] = [];
  try {
    for (let index = 0; index < 2; index++) {
      const email = `beta-${randomUUID()}@example.test`;
      const password = `Beta-${randomUUID()}-aA1!`;
      const {data, error} = await admin.auth.admin.createUser({email, password, email_confirm: true});
      if (error || !data.user) throw error ?? new Error("Local user creation failed");
      users.push({id: data.user.id, email, password});
    }
    return users as [BetaUser, BetaUser];
  } catch (error) {
    await cleanupBetaUsers(admin, users);
    throw error;
  }
}

export async function cleanupBetaUsers(admin: SupabaseClient<Database>, users: readonly BetaUser[]): Promise<void> {
  const errors: string[] = [];
  for (const user of users) {
    const {error} = await admin.auth.admin.deleteUser(user.id);
    if (error) errors.push(`${user.id}: ${error.message}`);
  }
  if (errors.length) throw new Error(`Local user cleanup failed: ${errors.join("; ")}`);
}

export async function readTodayPlan(page: Page): Promise<TodayPlanDTO> {
  return page.evaluate(async () => {
    const response = await fetch("/api/today", {cache: "no-store"});
    if (!response.ok) throw new Error(`Local Today request failed: ${response.status}`);
    return response.json();
  });
}

export async function completeDaily30(page: Page, plan: TodayPlanDTO): Promise<void> {
  const targets = plan.dailyTargets ?? [];
  expect(targets).toHaveLength(30);
  const session = await page.evaluate(async (planId) => {
    const response = await fetch(`/api/today/events?planId=${encodeURIComponent(planId)}`, {cache: "no-store"});
    if (!response.ok) throw new Error(`Local Today session failed: ${response.status}`);
    return response.json() as Promise<{completedTargetIds: string[]}>;
  }, plan.id);
  for (let index = session.completedTargetIds.length; index < targets.length; index++) {
    const target = targets[index];
    await expect(page.getByRole("heading", {name: target.word, exact: true})).toBeVisible();
    await page.getByRole("button", {name: "认识", exact: true}).click();
    const answer = target.source === "root-core" || target.originSource === "root-core"
      ? target.rootMeaningZh[0] : target.coreMeaningZh;
    await page.getByRole("button", {name: answer, exact: true}).click();
    await page.getByRole("textbox", {name: "填入目标词"}).fill(target.lemma);
    await page.getByRole("button", {name: "提交", exact: true}).click();
    await page.getByRole("button", {name: "想起来了"}).click();
    if ((index + 1) % 10 === 0) {
      await expect(page.getByRole("heading", {name: "Mini Review"})).toBeVisible();
      for (let review = 0; review < 3; review++) {
        await page.getByRole("button", {name: "想起来了"}).click();
      }
      await expect(page.getByRole("button", {name: "继续下一个 Block"})).toBeVisible();
      await page.getByRole("button", {name: "继续下一个 Block"}).click();
    }
  }
  await expect(page.getByRole("heading", {name: "Final Review"})).toBeVisible();
  for (let review = 0; review < 5; review++) {
    if (await page.getByRole("button", {name: "完成今日计划"}).count()) break;
    await page.getByRole("button", {name: "想起来了"}).click();
  }
  await page.getByRole("button", {name: "完成今日计划"}).click();
  await expect(page.getByText("今日完成", {exact: true})).toBeVisible();
}
