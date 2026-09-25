import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import {expect, test, type Page} from "@playwright/test";
import {createWordProgress} from "@/lib/storage";
import type {Database, Json} from "@/types/database";
import type {DailyReadingRecommendation} from "@/types/reading-recommendations";
import {readTodayPlan} from "./support/local-rootline";

const localUrl = process.env.E2E_SUPABASE_URL;
const serviceKey = process.env.E2E_SERVICE_ROLE_KEY;
const ready = localUrl === "http://127.0.0.1:56421" && Boolean(serviceKey?.startsWith("sb_secret_"));
const wordIds = (JSON.parse(readFileSync(resolve(process.cwd(), "data/vocabulary/production-catalog.json"), "utf8")) as Array<{id: string}>)
  .map((word) => word.id);
let admin: SupabaseClient<Database>;
let userId = "";
let email = "";
let password = "";
let articleId = "";

test.beforeAll(async () => {
  test.setTimeout(180_000);
  if (!ready) return;
  admin = createClient<Database>(localUrl!, serviceKey!, {auth: {persistSession: false, autoRefreshToken: false}});
  email = `beta-performance-${randomUUID()}@example.test`;
  password = `Beta-${randomUUID()}-aA1!`;
  const {data, error} = await admin.auth.admin.createUser({email, password, email_confirm: true});
  if (error || !data.user) throw error ?? new Error("Local performance user creation failed");
  userId = data.user.id;
  for (let offset = 0; offset < wordIds.length; offset += 250) {
    const rows = wordIds.slice(offset, offset + 250).map((wordId) => ({user_id: userId, word_id: wordId,
      state: createWordProgress(wordId) as unknown as Json}));
    const write = await admin.from("word_learning_states").insert(rows);
    if (write.error) throw write.error;
  }
});

test.afterAll(async () => {
  if (!ready || !admin) return;
  if (articleId) {
    const article = await admin.from("articles").delete().eq("id", articleId);
    if (article.error) throw article.error;
  }
  if (userId) {
    const user = await admin.auth.admin.deleteUser(userId);
    if (user.error) throw user.error;
  }
});

test("near-10K local-state response measurements", async ({page}) => {
  test.setTimeout(180_000);
  test.skip(!ready, "Requires the isolated local Phase 4 Supabase stack.");
  expect(wordIds.length).toBeGreaterThanOrEqual(9_500);
  await page.goto("/login?next=%2Fsettings%2Faccount");
  await page.getByRole("textbox", {name: "邮箱"}).fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", {name: "登录"}).click();
  await expect(page).toHaveURL(/\/settings\/account/);
  const initial = await measure(page, "/api/today");
  const plan = await readTodayPlan(page);
  const resume = await measure(page, "/api/today");
  expect(plan.dailyTargets).toHaveLength(30);

  articleId = randomUUID();
  const recommendation: DailyReadingRecommendation = {
    articleId, title: "Local performance article", canonicalUrl: `https://example.test/${articleId}`,
    publisherUrl: `https://example.test/${articleId}`, sourceKey: "phase4-performance", sourceTitle: "Local fixture",
    attribution: "Local fixture", publishedAt: new Date().toISOString(), summary: "An adapt example for reading performance.",
    scores: {todayMatches: 0, recentMatches: 0, difficultyFit: 0, freshness: 0, sourceQuality: 0, total: 0},
    matchedTodayWordIds: [], matchedRecentWordIds: [], matchedRecent7DayWordIds: [],
    estimatedUnknownCoverage: {percent: 10, approximate: true, basis: "tracked-vocabulary-match-occurrences"}, reasonCodes: []
  };
  const article = await admin.from("articles").insert({id: articleId, canonical_url: recommendation.canonicalUrl,
    publisher_url: recommendation.publisherUrl, title: recommendation.title, summary: recommendation.summary, language: "en"});
  if (article.error) throw article.error;
  const snapshot = await admin.from("daily_reading_recommendation_sets").insert({user_id: userId,
    learning_date: plan.date, algorithm_version: "phase4-performance-local", generated_at: new Date().toISOString(),
    recommendations: [recommendation] as unknown as Json});
  if (snapshot.error) throw snapshot.error;

  const readingList = await measure(page, "/api/reading/recommendations");
  const articlePage = await measure(page, `/reading/daily/${articleId}`);
  const progress = await measure(page, "/progress");
  const result = {stateRows: wordIds.length, todayInitial: initial, todayResume: resume, readingList, articlePage, progress};
  for (const metric of [initial, resume, readingList, articlePage, progress]) expect(metric.status).toBe(200);
  console.log(`BETA_PERFORMANCE ${JSON.stringify(result)}`);
});

async function measure(page: Page, path: string): Promise<{status: number; ms: number; bytes: number}> {
  return page.evaluate(async (url) => {
    const start = performance.now();
    const response = await fetch(url, {cache: "no-store"});
    const body = await response.text();
    return {status: response.status, ms: Math.round(performance.now() - start), bytes: new TextEncoder().encode(body).byteLength};
  }, path);
}
