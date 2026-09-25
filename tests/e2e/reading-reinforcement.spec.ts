import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database, Json } from "@/types/database";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";
import type { PublicSession } from "@/lib/reading/reinforcement/types";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";

const localUrl = process.env.E2E_SUPABASE_URL;
const serviceKey = process.env.E2E_SERVICE_ROLE_KEY;
const ready = Boolean(localUrl && serviceKey && isLocal(localUrl));
const vocabulary = JSON.parse(readFileSync(resolve(process.cwd(), "data/vocabulary/production-catalog.json"), "utf8")) as ProductionVocabularyEntry[];
const byId = new Map(vocabulary.map((item) => [item.id, item]));
let admin: SupabaseClient<Database>;
let userId = "";
let articleId = "";
let email = "";
let password = "";

test.beforeAll(async () => {
  if (!ready) return;
  admin = createClient<Database>(localUrl!, serviceKey!, {auth: {persistSession: false, autoRefreshToken: false}});
  email = `phase2c-${randomUUID()}@example.test`;
  password = `Phase2C-${randomUUID()}-aA1!`;
  const {data, error} = await admin.auth.admin.createUser({email, password, email_confirm: true});
  if (error || !data.user) throw new Error(`Unable to create local-only verified fixture: ${error?.message}`);
  userId = data.user.id;
});

test.afterAll(async () => {
  if (!ready || !admin) return;
  if (articleId) {
    const {error} = await admin.from("articles").delete().eq("id", articleId);
    if (error) throw error;
  }
  if (userId) {
    const {error} = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
});

test("authenticated Reading evidence and three-mode practice preserve Today across refresh and viewports", async ({page}) => {
  test.setTimeout(90_000);
  test.skip(!ready, "Requires an explicitly local Supabase URL and local service-role key; never use a remote project.");
  await page.goto("/login?next=%2Ftoday");
  await page.getByRole("textbox", {name: "邮箱"}).fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", {name: "登录"}).click();
  await expect(page).toHaveURL(/\/today/);
  const before = await readToday(page);
  const today = before.plan.dailyTargets.find((item) => /^[A-Za-z]+$/.test(item.lemma) && item.coreMeaningZh?.trim());
  expect(today, "Local Today plan needs a safe vocabulary target").toBeTruthy();
  const recent = ["adapt", "analyze", "explain", "compare"].map((id) => byId.get(id)!)
    .filter((item) => item && item.id !== today!.wordId).slice(0, 2);
  expect(recent).toHaveLength(2);
  articleId = randomUUID();
  const summary = `The report discusses ${today!.lemma} in the project. Teams ${recent[0].lemma} methods and ${recent[1].lemma} results.`;
  const recommendation: DailyReadingRecommendation = {
    articleId, title: "Local Phase 2C reading fixture", canonicalUrl: `https://example.test/${articleId}`,
    publisherUrl: `https://example.test/${articleId}`, sourceKey: "phase-2c-local", sourceTitle: "Local fixture",
    attribution: "Local fixture", publishedAt: new Date().toISOString(), summary,
    scores: {todayMatches: 1, recentMatches: 2, difficultyFit: 0, freshness: 0, sourceQuality: 0, total: 0},
    matchedTodayWordIds: [today!.wordId], matchedRecentWordIds: recent.map((item) => item.id),
    matchedRecent7DayWordIds: recent.map((item) => item.id),
    estimatedUnknownCoverage: {percent: 10, approximate: true, basis: "tracked-vocabulary-match-occurrences"},
    reasonCodes: []
  };
  const articleWrite = await admin.from("articles").insert({id: articleId, canonical_url: recommendation.canonicalUrl,
    publisher_url: recommendation.publisherUrl, title: recommendation.title, summary, language: "en"});
  if (articleWrite.error) throw articleWrite.error;
  const snapshotWrite = await admin.from("daily_reading_recommendation_sets").insert({user_id: userId,
    learning_date: before.plan.date, algorithm_version: "phase-2c-local-e2e", generated_at: new Date().toISOString(),
    recommendations: [recommendation] as unknown as Json});
  if (snapshotWrite.error) throw snapshotWrite.error;

  await page.goto(`/reading/daily/${articleId}`);
  const summaryRegion = page.getByRole("article", {name: "文章摘要"});
  await expect(summaryRegion).toBeVisible();
  const todayButton = summaryRegion.getByRole("button", {name: new RegExp(`${today!.lemma}，今日词`, "i")});
  await todayButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  const recentButton = summaryRegion.getByRole("button", {name: new RegExp(`${recent[0].lemma}，近 7 日词`, "i")});
  await recentButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(() => countEvidence("reading-exposure")).toBe(3);
  await expect.poll(() => countEvidence("reading-lookup")).toBe(2);
  for (const width of [390, 430, 768, 1440]) {
    await page.setViewportSize({width, height: 900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  let repeatedExposureResponses = 0;
  page.on("response", (response) => {
    if (response.url().endsWith(`/api/reading/articles/${articleId}/evidence`)
      && response.request().postData()?.includes('"action":"exposure"')) repeatedExposureResponses++;
  });
  await page.reload();
  await expect(page.getByRole("article", {name: "文章摘要"})).toBeVisible();
  await expect.poll(() => repeatedExposureResponses).toBe(3);
  expect(await countEvidence("reading-exposure")).toBe(3);
  expect(await countEvidence("reading-lookup")).toBe(2);
  await page.getByRole("button", {name: "完成阅读"}).click();
  await expect(page.getByText("已完成阅读")).toBeVisible();
  await expect(page.getByText("主动查看：2")).toBeVisible();
  await page.getByRole("button", {name: "快速巩固 3 个词"}).click();
  await expect(page).toHaveURL(/\/reading\/reinforcement\//);
  for (const width of [390, 430, 768, 1440]) {
    await page.setViewportSize({width, height: 900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const sessionId = new URL(page.url()).pathname.split("/").pop()!;
  const answered: {questionId: string; answer: string; wordId: string}[] = [];

  for (const expectedMode of ["recognition", "cloze", "recall"] as const) {
    const session = await readSession(page, sessionId);
    expect(session.currentQuestion?.type).toBe(expectedMode);
    const question = session.currentQuestion!;
    const word = byId.get(question.wordId)!;
    const answer = expectedMode === "recognition" ? word.coreMeaningZh : word.lemma;
    if (expectedMode === "recognition") {
      const choice = page.getByRole("radio", {name: answer});
      await choice.focus();
      await page.keyboard.press("Space");
      await expect(choice).toBeChecked();
    } else {
      await expect(page.getByText(question.context)).toBeVisible();
      expect(question.context).toContain("____");
      await page.getByRole("textbox", {name: "你的答案"}).fill(answer);
    }
    const submit = page.getByRole("button", {name: "提交答案"});
    if (expectedMode === "recognition") {
      await page.keyboard.press("Tab");
      await expect(submit).toBeFocused();
      await page.keyboard.press("Enter");
    } else {
      await submit.click();
    }
    await expect(page.getByText(/回答正确/)).toBeVisible();
    answered.push({questionId: question.id, answer, wordId: question.wordId});
    await expect.poll(async () => (await readSession(page, sessionId)).cursor).toBe(answered.length);
    if (expectedMode === "cloze") {
      await page.reload();
      await expect(page.getByText("第 3 / 3 题")).toBeVisible();
    }
  }
  await expect(page.getByRole("heading", {name: "已完成 3 个词"})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", {name: "已完成 3 个词"})).toBeVisible();
  const first = answered[0];
  const replay = await page.evaluate(async ({sessionId, first}) => {
    const response = await fetch(`/api/reading/reinforcement/${sessionId}/answers`, {method: "POST",
      headers: {"content-type": "application/json"}, body: JSON.stringify({questionId: first.questionId, answer: first.answer})});
    return {status: response.status, body: await response.json()};
  }, {sessionId, first});
  expect(replay.status).toBe(200);
  expect(replay.body.session.cursor).toBe(3);
  const {data: events, error: eventsError} = await admin.from("review_events")
    .select("client_event_id").eq("user_id", userId).eq("client_event_id", `reading-answer:${sessionId}:${first.questionId}`);
  if (eventsError) throw eventsError;
  expect(events).toHaveLength(1);
  const {data: state, error: stateError} = await admin.from("word_learning_states")
    .select("state").eq("user_id", userId).eq("word_id", first.wordId).single();
  if (stateError) throw stateError;
  expect((state.state as {readingRevision: number}).readingRevision).toBe(1);
  await page.goto(`/reading/daily/${articleId}`);
  await expect(page.getByText("巩固练习：3")).toBeVisible();
  await expect(page.getByText("答对：3")).toBeVisible();
  await page.goto("/today");
  expect(await readToday(page)).toEqual(before);
});

async function countEvidence(prefix: "reading-exposure" | "reading-lookup"): Promise<number> {
  const {count, error} = await admin.from("review_events")
    .select("id", {count: "exact", head: true}).eq("user_id", userId)
    .like("client_event_id", `${prefix}:${articleId}:%`);
  if (error) throw error;
  return count ?? 0;
}

async function readSession(page: import("@playwright/test").Page, sessionId: string): Promise<PublicSession> {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/reading/reinforcement/${id}`, {cache: "no-store"});
    if (!response.ok) throw new Error(`Session read failed: ${response.status}`);
    return (await response.json()).session;
  }, sessionId);
}

async function readToday(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const planResponse = await fetch("/api/today", {cache: "no-store"});
    if (!planResponse.ok) throw new Error(`Today plan failed: ${planResponse.status}`);
    const plan = await planResponse.json() as {id: string; date: string; status: string;
      dailyTargets: {wordId: string; lemma: string; coreMeaningZh: string}[]};
    const sessionResponse = await fetch(`/api/today/events?planId=${plan.id}`, {cache: "no-store"});
    if (!sessionResponse.ok) throw new Error(`Today session failed: ${sessionResponse.status}`);
    const session = await sessionResponse.json();
    return {plan, session};
  });
}

function isLocal(value: string): boolean {
  try {return ["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname);}
  catch {return false;}
}
