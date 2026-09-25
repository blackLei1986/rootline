import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import {expect, test, type Page} from "@playwright/test";
import type {Database, Json} from "@/types/database";
import type {DailyReadingRecommendation} from "@/types/reading-recommendations";
import type {ProductionVocabularyEntry} from "@/types/vocabulary";
import type {PublicSession} from "@/lib/reading/reinforcement/types";
import {cleanupBetaUsers, completeDaily30, createBetaUsers, readTodayPlan, type BetaUser} from "./support/local-rootline";
import {learningDateForTimeZone} from "@/lib/today/local-date";

const localUrl = process.env.E2E_SUPABASE_URL;
const serviceKey = process.env.E2E_SERVICE_ROLE_KEY;
const ready = localUrl === "http://127.0.0.1:56421" && Boolean(serviceKey?.startsWith("sb_secret_"));
const catalog = JSON.parse(readFileSync(resolve(process.cwd(), "data/vocabulary/production-catalog.json"), "utf8")) as ProductionVocabularyEntry[];
const byId = new Map(catalog.map((word) => [word.id, word]));
let admin: SupabaseClient<Database>;
let users: [BetaUser, BetaUser];
const articleIds: string[] = [];
let trustedRoot: {datasetId: string; rootId: string; recordId: string} | null = null;

test.beforeAll(async () => {
  if (!ready) return;
  admin = createClient<Database>(localUrl!, serviceKey!, {auth: {persistSession: false, autoRefreshToken: false}});
  users = await createBetaUsers(admin);
  trustedRoot = {datasetId: randomUUID(), rootId: randomUUID(), recordId: randomUUID()};
  const dataset = await admin.from("morphology_datasets").insert({id: trustedRoot.datasetId,
    version: `phase4-beta-${randomUUID()}`, kind: "gold", status: "published", source: "local-e2e",
    provenance: {}, published_at: new Date().toISOString()});
  if (dataset.error) throw dataset.error;
  const root = await admin.from("morphology_roots").insert({id: trustedRoot.rootId, dataset_id: trustedRoot.datasetId,
    root_key: "apt", meaning_en: ["fit"], meaning_zh: ["适应"], educational_content: {}, provenance: {}});
  if (root.error) throw root.error;
  const record = await admin.from("word_morphology_records").insert({id: trustedRoot.recordId,
    dataset_id: trustedRoot.datasetId, catalog_word_id: "adapt", word: "adapt", lemma: "adapt",
    primary_root_id: trustedRoot.rootId, confidence: "verified", morphology_score: 100,
    source: "local-e2e", provenance: {}, review_status: "approved", revision: 1,
    morphology_expression: "ad + apt", literal_meaning: "fit toward", reviewed_at: new Date().toISOString()});
  if (record.error) throw record.error;
  const segment = await admin.from("word_morphology_segments").insert({word_morphology_record_id: trustedRoot.recordId,
    position: 0, kind: "root", surface_form: "apt", normalized_form: "apt", root_id: trustedRoot.rootId, provenance: {}});
  if (segment.error) throw segment.error;
  const {error} = await admin.from("profiles").update({timezone: "Pacific/Kiritimati"}).eq("user_id", users[0].id);
  if (error) throw error;
});

test.afterAll(async () => {
  if (!ready || !admin) return;
  for (const articleId of articleIds) {
    const {error} = await admin.from("articles").delete().eq("id", articleId);
    if (error) throw error;
  }
  if (users) await cleanupBetaUsers(admin, users);
  if (trustedRoot) {
    const record = await admin.from("word_morphology_records").delete().eq("id", trustedRoot.recordId);
    if (record.error) throw record.error;
    const root = await admin.from("morphology_roots").delete().eq("id", trustedRoot.rootId);
    if (root.error) throw root.error;
    const dataset = await admin.from("morphology_datasets").delete().eq("id", trustedRoot.datasetId);
    if (dataset.error) throw dataset.error;
  }
});

test("verified local learner completes Today and Reading without cross-account leakage", async ({page, browser}) => {
  test.setTimeout(360_000);
  test.skip(!ready, "Requires the isolated local Phase 4 Supabase Auth stack.");
  await login(page, users[0]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/today/);
  const plan = await readTodayPlan(page);
  expect(plan.dailyTargets).toHaveLength(30);
  expect(plan.date).toBe(learningDateForTimeZone(new Date(), "Pacific/Kiritimati"));
  await page.getByRole("button", {name: "开始今日学习"}).click();
  const first = plan.dailyTargets![0];
  await expect(page.getByRole("heading", {name: first.word, exact: true})).toBeVisible();
  const staleTab = await page.context().newPage();
  await staleTab.goto("/today");
  await staleTab.getByRole("button", {name: "继续今日学习"}).click();
  await expect(staleTab.getByRole("heading", {name: first.word, exact: true})).toBeVisible();
  await page.reload();
  await page.getByRole("button", {name: "继续今日学习"}).click();
  await expect(page.getByRole("heading", {name: first.word, exact: true})).toBeVisible();
  await page.getByRole("button", {name: "认识", exact: true}).click();
  await staleTab.getByRole("button", {name: "认识", exact: true}).click();
  await expect(staleTab.locator("main [role=alert]")).toContainText("已同步最新进度");
  await staleTab.close();
  const association = first.source === "root-core" || first.originSource === "root-core"
    ? first.rootMeaningZh[0] : first.coreMeaningZh;
  await page.getByRole("button", {name: association, exact: true}).click();
  const clozeInput = page.getByRole("textbox", {name: "填入目标词"});
  await clozeInput.fill("an exceptionally long answer that should remain readable and must not push the submit control off screen");
  for (const width of [390, 430, 768, 1440]) {
    await page.setViewportSize({width, height: 900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Today cloze overflows at ${width}px`).toBe(true);
    const input = await clozeInput.boundingBox();
    const submit = await page.getByRole("button", {name: "提交", exact: true}).boundingBox();
    expect(input && input.x + input.width <= width + 1).toBe(true);
    expect(submit && submit.x + submit.width <= width + 1).toBe(true);
  }
  await clozeInput.fill(first.lemma);
  await page.getByRole("button", {name: "提交", exact: true}).click();
  await page.getByRole("button", {name: "想起来了"}).click();
  await page.reload();
  await expect(page.getByRole("button", {name: "继续今日学习"})).toBeVisible();
  expect((await readTodayPlan(page)).id).toBe(plan.id);
  await page.getByRole("button", {name: "继续今日学习"}).click();
  await completeDaily30(page, plan);
  await page.reload();
  await expect(page.getByRole("heading", {name: "30 / 30"})).toBeVisible();
  expect((await readTodayPlan(page)).id).toBe(plan.id);

  const articleId = randomUUID();
  const recent = ["adapt", "analyze", "explain", "compare"].map((id) => byId.get(id)!)
    .filter((word) => word && word.id !== first.wordId).slice(0, 2);
  expect(recent).toHaveLength(2);
  const summary = `The report discusses ${first.lemma} in the project. Teams ${recent[0].lemma} methods and ${recent[1].lemma} results.`;
  const recommendations: DailyReadingRecommendation[] = [];
  for (let index = 0; index < 3; index++) {
    const id = index === 0 ? articleId : randomUUID();
    articleIds.push(id);
    const recommendation: DailyReadingRecommendation = {
      articleId: id, title: `Local Beta reading fixture ${index + 1}`, canonicalUrl: `https://example.test/${id}`,
      publisherUrl: `https://example.test/${id}`, sourceKey: "phase4-local", sourceTitle: "Local fixture",
      attribution: "Local fixture", publishedAt: new Date().toISOString(), summary,
      scores: {todayMatches: 1, recentMatches: 2, difficultyFit: 0, freshness: 0, sourceQuality: 0, total: 0},
      matchedTodayWordIds: [first.wordId], matchedRecentWordIds: recent.map((word) => word.id),
      matchedRecent7DayWordIds: recent.map((word) => word.id),
      estimatedUnknownCoverage: {percent: 10, approximate: true, basis: "tracked-vocabulary-match-occurrences"}, reasonCodes: []
    };
    recommendations.push(recommendation);
    const article = await admin.from("articles").insert({id, canonical_url: recommendation.canonicalUrl,
      publisher_url: recommendation.publisherUrl, title: recommendation.title, summary, language: "en"});
    if (article.error) throw article.error;
  }
  const snapshot = await admin.from("daily_reading_recommendation_sets").insert({user_id: users[0].id,
    learning_date: plan.date, algorithm_version: "phase4-local-e2e", generated_at: new Date().toISOString(),
    recommendations: recommendations as unknown as Json});
  if (snapshot.error) throw snapshot.error;
  await page.goto("/reading");
  await expect(page.getByRole("heading", {name: "今日阅读", exact: true})).toBeVisible();
  await expect(page.getByText("Local Beta reading fixture 1")).toBeVisible();
  await expect(page.getByText("Local Beta reading fixture 3")).toBeVisible();
  await page.goto(`/reading/daily/${articleId}`);
  await expect(page.getByRole("article", {name: "文章摘要"})).toBeVisible();
  await page.getByRole("article", {name: "文章摘要"}).getByRole("button", {name: new RegExp(`${first.lemma}，今日词`, "i")}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  for (const width of [390, 430, 768, 1440]) {
    await page.setViewportSize({width, height: 900});
    const dialog = await page.getByRole("dialog").boundingBox();
    expect(dialog && dialog.x >= -1 && dialog.x + dialog.width <= width + 1).toBe(true);
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", {name: "完成阅读"}).click();
  await expect(page.getByText("已完成阅读")).toBeVisible();
  await page.getByRole("button", {name: "快速巩固 3 个词"}).click();
  await expect(page).toHaveURL(/\/reading\/reinforcement\//);
  const sessionId = new URL(page.url()).pathname.split("/").pop()!;
  for (const width of [390, 430, 768, 1440]) {
    await page.setViewportSize({width, height: 900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Reading exercise overflows at ${width}px`).toBe(true);
  }
  for (const mode of ["recognition", "cloze", "recall"] as const) {
    const session = await readReadingSession(page, sessionId);
    const question = session.currentQuestion!;
    expect(question.type).toBe(mode);
    const word = byId.get(question.wordId)!;
    const answer = mode === "recognition" ? word.coreMeaningZh : word.lemma;
    if (mode === "recognition") await page.getByRole("radio", {name: answer}).check();
    else await page.getByRole("textbox", {name: "你的答案"}).fill(answer);
    await page.getByRole("button", {name: "提交答案"}).click();
    await expect.poll(async () => (await readReadingSession(page, sessionId)).cursor).toBe(session.cursor + 1);
  }
  await expect(page.getByRole("heading", {name: "已完成 3 个词"})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", {name: "已完成 3 个词"})).toBeVisible();
  await page.goto(`/reading/daily/${articleId}`);
  await expect(page.getByText("巩固练习：3")).toBeVisible();
  await page.goto("/today");
  await expect(page.getByRole("heading", {name: "30 / 30"})).toBeVisible();

  for (const width of [390, 430, 768, 1440]) {
    await page.setViewportSize({width, height: 900});
    for (const route of ["/today", "/reading", `/reading/daily/${articleId}`, "/progress", "/roots", "/roots/apt", "/me"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", {level: 1}).first()).toBeVisible();
      if (route === "/progress") await expect(page.getByRole("region", {name: "今日学习"})).toContainText(plan.date);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} overflows at ${width}px`).toBe(true);
      const layout = await page.evaluate(() => {
        const clipped = [...document.querySelectorAll("main button, main a")]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
          }).map((element) => element.textContent?.trim() || element.getAttribute("aria-label") || element.tagName);
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, document.documentElement.scrollHeight);
        const mobileNav = document.querySelector('nav[aria-label="移动主导航"]')?.getBoundingClientRect();
        const footer = document.querySelector("footer")?.getBoundingClientRect();
        return {clipped, mobileNavTop: mobileNav?.top ?? null, mobileNavBottom: mobileNav?.bottom ?? null,
          footerBottom: footer?.bottom ?? null};
      });
      expect(layout.clipped, `${route} has clipped controls at ${width}px`).toEqual([]);
      if (width < 768) {
        expect(layout.mobileNavBottom).toBeGreaterThanOrEqual(899);
        expect(layout.mobileNavTop).toBeGreaterThan(800);
        expect(layout.footerBottom).toBeLessThanOrEqual(layout.mobileNavTop! + 1);
      }
    }
  }

  const second = await browser.newContext();
  try {
    const other = await second.newPage();
    await login(other, users[1]);
    const otherPlan = await readTodayPlan(other);
    expect(otherPlan.id).not.toBe(plan.id);
    await other.goto("/progress");
    await expect(other.getByRole("region", {name: "今日学习"})).not.toContainText("30 / 30");
    await other.goto("/reading");
    await expect(other.getByText("Local Beta reading fixture 1")).toHaveCount(0);
    const crossRead = await other.evaluate(async (id) => {
      const response = await fetch(`/api/today/events?planId=${encodeURIComponent(id)}`);
      return response.status;
    }, plan.id);
    expect(crossRead).toBeGreaterThanOrEqual(400);
  } finally { await second.close(); }
});

async function login(page: Page, user: BetaUser) {
  await page.goto("/login?next=%2Ftoday");
  await page.getByRole("textbox", {name: "邮箱"}).fill(user.email);
  await page.getByLabel("密码").fill(user.password);
  await page.getByRole("button", {name: "登录"}).click();
  await expect(page).toHaveURL(/\/today/);
}

async function readReadingSession(page: Page, sessionId: string): Promise<PublicSession> {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/reading/reinforcement/${id}`, {cache: "no-store"});
    if (!response.ok) throw new Error(`Reading session request failed: ${response.status}`);
    return (await response.json()).session;
  }, sessionId);
}
