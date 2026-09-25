import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import {expect, test, type Page} from "@playwright/test";
import {createWordProgress} from "@/lib/storage";
import type {Database, Json} from "@/types/database";

const localUrl = process.env.E2E_SUPABASE_URL;
const serviceKey = process.env.E2E_SERVICE_ROLE_KEY;
const ready = localUrl === "http://127.0.0.1:54321" && Boolean(serviceKey?.startsWith("sb_secret_"));
const catalog = JSON.parse(readFileSync(resolve(process.cwd(), "data/vocabulary/production-catalog.json"), "utf8")) as Array<{id: string}>;
const accounts: Array<{id: string; email: string; password: string}> = [];
let admin: SupabaseClient<Database>;

test.beforeAll(async () => {
  if (!ready) return;
  admin = createClient<Database>(localUrl!, serviceKey!, {auth: {persistSession: false, autoRefreshToken: false}});
  for (let index = 0; index < 2; index++) {
    const email = `phase3-${randomUUID()}@example.test`;
    const password = `Phase3-${randomUUID()}-aA1!`;
    const {data, error} = await admin.auth.admin.createUser({email, password, email_confirm: true});
    if (error || !data.user) throw new Error(`Unable to create local verified fixture: ${error?.message}`);
    accounts.push({id: data.user.id, email, password});
  }
  const now = Date.now();
  const state = {...createWordProgress("adapt"), status: "review" as const,
    firstLearnedAt: new Date(now - 4 * 86_400_000).toISOString(),
    lastReviewedAt: new Date(now - 2 * 86_400_000).toISOString(),
    nextReviewAt: new Date(now + 7 * 86_400_000).toISOString(),
    correctCount: 2, reviewCount: 2, memoryStrength: 60, lastRating: "good" as const};
  const {error} = await admin.from("word_learning_states").insert({user_id: accounts[0].id,
    word_id: "adapt", state: state as unknown as Json});
  if (error) throw error;
  const encounterWordIds = catalog.map((entry) => entry.id).filter((id) => id !== "adapt").slice(0, 1_001);
  if (encounterWordIds.length !== 1_001) throw new Error("Local catalog lacks the passive-evidence page-boundary fixture.");
  for (let offset = 0; offset < encounterWordIds.length; offset += 250) {
    const batch = encounterWordIds.slice(offset, offset + 250).map((wordId) => ({user_id: accounts[0].id,
      word_id: wordId, document_kind: "article" as const, document_id: "phase3-local-completed-article",
      first_encountered_at: new Date(now).toISOString(), last_encountered_at: new Date(now).toISOString()}));
    const write = await admin.from("vocabulary_encounters").insert(batch);
    if (write.error) throw write.error;
  }
});

test.afterAll(async () => {
  if (!ready || !admin) return;
  const failures: string[] = [];
  for (const account of accounts) {
    const {error} = await admin.auth.admin.deleteUser(account.id);
    if (error) failures.push(error.message);
  }
  if (failures.length) throw new Error(`Local fixture cleanup failed: ${failures.join("; ")}`);
});

test("verified Progress matches Today, persists one observation, isolates accounts, and fits four widths", async ({page, browser}) => {
  test.setTimeout(120_000);
  test.skip(!ready, "Use the fixed local Phase 3 runner; remote credentials are forbidden.");
  await login(page, accounts[0]);
  const firstPlan = await readTodayPlan(page);
  expect(firstPlan.dailyTargets.length).toBeGreaterThan(0);
  await page.goto("/progress");
  await expect(page.getByRole("heading", {name: "学习进度"})).toBeVisible();
  await expect(page.getByRole("region", {name: "稳定掌握"})).toContainText("1 / 10,000");
  await expect(page.getByRole("region", {name: "稳定掌握"})).toContainText("接触过 1,001");
  const today = page.getByRole("region", {name: "今日学习"});
  await expect(today).toContainText(firstPlan.date);
  await expect(today).toContainText(`0 / ${firstPlan.dailyTargets.length}`);
  await expect(today).toContainText("未开始");
  await expect(page.getByRole("region", {name: "近 7 日"})).toContainText("0 / 1 天");
  await expect(page.getByRole("region", {name: "近 30 日"})).toContainText("0 / 1 天");
  await expect(page.getByRole("region", {name: "词根掌握"})).toContainText("apt");
  await expect(page.getByRole("region", {name: "词根掌握"})).toContainText("稳定 1 / 1");
  await markTodayComplete(accounts[0].id, firstPlan);
  await page.goto("/today");
  await expect(page.getByRole("heading", {name: `${firstPlan.dailyTargets.length} / ${firstPlan.dailyTargets.length}`})).toBeVisible();
  await expect(page.getByText("今日完成", {exact: true})).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByRole("region", {name: "今日学习"})).toContainText("已完成");
  await expect(page.getByRole("region", {name: "今日学习"})).toContainText(`${firstPlan.dailyTargets.length} / ${firstPlan.dailyTargets.length}`);
  await expect(page.getByRole("region", {name: "今日学习"})).toContainText("连续完成 1 天");
  await expect(page.getByRole("region", {name: "近 7 日"})).toContainText("1 / 1 天");
  await expect(page.getByRole("region", {name: "近 30 日"})).toContainText("1 / 1 天");
  for (const width of [390, 430, 768, 1440]) {
    await page.setViewportSize({width, height: 900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}px`).toBe(true);
  }
  await expect.poll(() => snapshotRows(accounts[0].id)).toEqual([{learning_date: firstPlan.date, stable_count: 1}]);
  await page.reload();
  await expect(page.getByRole("region", {name: "稳定掌握"})).toContainText("1 / 10,000");
  expect(await snapshotRows(accounts[0].id)).toEqual([{learning_date: firstPlan.date, stable_count: 1}]);

  const secondContext = await browser.newContext();
  try {
    const secondPage = await secondContext.newPage();
    await login(secondPage, accounts[1]);
    const secondPlan = await readTodayPlan(secondPage);
    await secondPage.goto("/progress");
    await expect(secondPage.getByRole("region", {name: "稳定掌握"})).toContainText("0 / 10,000");
    await expect(secondPage.getByRole("region", {name: "今日学习"})).toContainText(secondPlan.date);
    await expect(secondPage.getByRole("region", {name: "近 7 日"})).toContainText("0 / 1 天");
    expect(await snapshotRows(accounts[1].id)).toEqual([{learning_date: secondPlan.date, stable_count: 0}]);
    expect(await snapshotRows(accounts[0].id)).toEqual([{learning_date: firstPlan.date, stable_count: 1}]);
  } finally {
    await secondContext.close();
  }
});

async function login(page: Page, account: {email: string; password: string}) {
  await page.goto("/login?next=%2Ftoday");
  await page.getByRole("textbox", {name: "邮箱"}).fill(account.email);
  await page.getByLabel("密码").fill(account.password);
  await page.getByRole("button", {name: "登录"}).click();
  await expect(page).toHaveURL(/\/today/);
}

async function readTodayPlan(page: Page): Promise<{id: string; date: string; dailyTargets: Array<{wordId: string}>}> {
  return page.evaluate(async () => {
    const response = await fetch("/api/today", {cache: "no-store"});
    if (!response.ok) throw new Error(`Local Today request failed: ${response.status}`);
    return response.json();
  });
}

async function markTodayComplete(userId: string, plan: {id: string; dailyTargets: Array<{wordId: string}>}) {
  const completedAt = new Date().toISOString();
  const planWrite = await admin.from("today_plans").update({status: "complete", completed_at: completedAt})
    .eq("user_id", userId).eq("id", plan.id);
  if (planWrite.error) throw planWrite.error;
  const sessionWrite = await admin.from("today_sessions").upsert({user_id: userId, plan_id: plan.id,
    status: "complete", current_stage: "summary", completed_at: completedAt,
    outcomes: {completedTargetIds: plan.dailyTargets.map((target) => target.wordId)} as Json}, {onConflict: "plan_id"});
  if (sessionWrite.error) throw sessionWrite.error;
}

async function snapshotRows(userId: string) {
  const {data, error} = await admin.from("progress_vocabulary_snapshots")
    .select("learning_date,stable_count").eq("user_id", userId).order("learning_date");
  if (error) throw error;
  return data;
}
