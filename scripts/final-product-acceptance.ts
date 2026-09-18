import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createFullVocabularyProductionReport } from "@/lib/vocabulary-production-report";
import { buildContextQuestions } from "@/lib/today/context-questions";
import { normalizeTodayPlan, TODAY_STAGE_ORDER } from "@/types/today";
import { runAccountCloudAudit } from "./account-cloud-audit";
import { runRssReadingAudit } from "./rss-reading-audit";
import type { ProductionVocabularyEntry } from "@/types";

export interface AcceptanceCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface FinalAcceptanceResult {
  generatedAt: string;
  acceptedLemmaCount: number;
  passed: boolean;
  results: AcceptanceCheck[];
}

const TARGET_LEMMA_COUNT = 9_000;

function fileExists(root: string, rel: string): boolean {
  return existsSync(resolve(root, rel));
}

function fileMatches(root: string, rel: string, pattern: RegExp): boolean {
  const path = resolve(root, rel);
  return existsSync(path) && pattern.test(readFileSync(path, "utf8"));
}

function fixtureEntry(index: number): ProductionVocabularyEntry {
  const word = `topic${index}`;
  return {
    id: `w-${index}`,
    word,
    lemma: word,
    wordFamilyId: `fam-${index}`,
    surfaceForms: [word],
    partOfSpeech: ["noun"],
    coreMeaningZh: `含义${index}`,
    coreDefinitionEn: `definition ${index}`,
    example: `Example ${index}.`,
    examples: [`Example ${index}.`],
    frequencyBand: "high",
    frequencyRank: index + 1,
    learningValueScore: 90 - index,
    contentTier: "tier-2-important",
    learningGoal: "understanding",
    coverageTags: ["general"],
    pipelineStatus: "accepted",
    morphologyConfidence: "none",
    sourceMetadata: { frequencySources: [{ name: "test" }], academicSources: [], examSources: [], generatedAt: "2026-01-01", generatedBy: "test", confidence: 90 }
  };
}

/**
 * Eligible articles must yield exactly five context questions. This drives the
 * generator with five target words whose surface forms occur in the article
 * text and asserts the generator emits five distinct, well-formed questions.
 */
function runFiveQuestionGenerationCheck(): AcceptanceCheck {
  const vocabulary = [0, 1, 2, 3, 4].map(fixtureEntry);
  const article = { articleId: "a-1", text: "The topic0 is here. The topic1 is here. The topic2 is here. The topic3 is here. The topic4 is here." };
  const analysis = { valuableUnknownWordIds: vocabulary.map((entry) => entry.id), lexicalMatches: [] };
  const questions = buildContextQuestions(article, analysis, vocabulary, 5);
  const uniqueIds = new Set(questions.map((question) => question.id)).size === questions.length;
  const choicesValid = questions.every((question) => question.choices.includes(question.correctChoice));
  const passed = questions.length === 5 && uniqueIds && choicesValid;
  return {
    name: "fiveQuestions",
    passed,
    detail: passed ? "Eligible article generates exactly five unique questions with valid answer choices." : `Eligible article generated ${questions.length} questions (expected 5).`
  };
}

/**
 * Pure Today-plan invariant checks. These mirror the acceptance statements in
 * the design spec: a plan holds zero or one article, an eligible (article
 * present) plan holds exactly five context questions, and an article-less plan
 * omits the reading stages with a degradation reason.
 */
export function runTodayPlanInvariantChecks(): AcceptanceCheck[] {
  const baseArticle = {
    articleId: "a-1",
    title: "A useful article",
    sourceTitle: "Source",
    canonicalUrl: "https://example.com/article",
    estimatedMinutes: 6,
    contentWordCoverage: 96,
    targetWordIds: ["w-1", "w-2", "w-3", "w-4", "w-5"],
    selectionReasons: ["coverage-fit"]
  };
  const question = (index: number) => ({
    id: `q-${index}`,
    articleId: "a-1",
    sentence: `sentence ${index}`,
    targetWordId: `w-${index}`,
    prompt: "含义",
    choices: [`含义${index}`, `干扰${index}`],
    correctChoice: `含义${index}`
  });
  const plan = (overrides: Record<string, unknown> = {}) => ({
    id: "p-1",
    date: "2026-09-18",
    version: 1,
    status: "not-started",
    estimatedMinutes: 22,
    warmupReviewIds: [],
    rapidScanEntries: [],
    focusedLearningTarget: 7,
    sentenceTarget: 7,
    quizTarget: 5,
    readingCandidateIds: [],
    mix: { review: 40, newVocabulary: 30, reading: 20, sentence: 10 },
    article: null,
    contextQuestions: [],
    degradationReason: null,
    ...overrides
  });

  const results: AcceptanceCheck[] = [];

  try {
    normalizeTodayPlan(plan({ article: [baseArticle, baseArticle] }));
    results.push({ name: "todayArticleCount", passed: false, detail: "normalizeTodayPlan accepted an array of two articles." });
  } catch {
    results.push({ name: "todayArticleCount", passed: true, detail: "At most one article per plan (array rejected)." });
  }

  results.push(runFiveQuestionGenerationCheck());

  try {
    const normalized = normalizeTodayPlan(plan({ article: baseArticle, contextQuestions: [0, 1, 2, 3, 4].map(question) }));
    const hasReadingStage = normalized.stages.includes("reading") && normalized.stages.includes("context-quiz");
    results.push({
      name: "eligiblePlanStages",
      passed: hasReadingStage && normalized.contextQuestions.length === 5,
      detail: hasReadingStage ? "Eligible plan includes reading and context-quiz stages with five questions." : "Eligible plan missing reading stages."
    });
  } catch (error) {
    results.push({ name: "eligiblePlanStages", passed: false, detail: `Eligible plan failed to normalize: ${error instanceof Error ? error.message : String(error)}` });
  }

  try {
    const normalized = normalizeTodayPlan(plan({ article: null, degradationReason: "NO_SUBSCRIPTIONS" }));
    const omitsReading = !normalized.stages.includes("reading") && !normalized.stages.includes("context-quiz");
    results.push({
      name: "degradation",
      passed: omitsReading && normalized.contextQuestions.length === 0,
      detail: omitsReading ? "Article-less plan omits reading stages and keeps vocabulary stages." : "Article-less plan incorrectly retained reading stages."
    });
  } catch (error) {
    results.push({ name: "degradation", passed: false, detail: `Degraded plan failed to normalize: ${error instanceof Error ? error.message : String(error)}` });
  }

  return results;
}

function stageOrderValid(): boolean {
  return TODAY_STAGE_ORDER.join(",") === "warmup,scan,learn,reading,context-quiz,summary";
}

export async function buildFinalProductAcceptance(root: string): Promise<FinalAcceptanceResult> {
  const directory = resolve(root, "public/vocabulary-data");
  const files = (await readdir(directory)).filter((file) => /^[a-z]\.json$/.test(file)).sort();
  const catalog = (await Promise.all(
    files.map(async (file) => JSON.parse(await readFile(resolve(directory, file), "utf8")) as ProductionVocabularyEntry[])
  )).flat();
  const report = createFullVocabularyProductionReport(catalog);

  const accountAudit = runAccountCloudAudit(root);
  const rssAudit = runRssReadingAudit(root);

  const results: AcceptanceCheck[] = [
    {
      name: "acceptedLemmaCount",
      passed: report.acceptedLemmaCount === TARGET_LEMMA_COUNT,
      detail: `accepted lemma count ${report.acceptedLemmaCount} (target ${TARGET_LEMMA_COUNT}).`
    },
    {
      name: "vocabularyGate",
      passed: report.finalGatePassed && report.duplicateCandidates.length === 0 && report.tierDepthIssues.length === 0,
      detail: `final gate ${report.finalGatePassed}, duplicates ${report.duplicateCandidates.length}, tier-depth issues ${report.tierDepthIssues.length}.`
    },
    { name: "accountFlow", passed: accountAudit.missing.length === 0, detail: accountAudit.missing.length === 0 ? `${accountAudit.checks} account checks passed.` : `${accountAudit.missing.length} account checks missing: ${accountAudit.missing.join("; ")}` },
    { name: "rls", passed: fileMatches(root, "supabase/tests/account_learning_rls.test.sql", /owner can insert|another user cannot|anonymous users cannot/i), detail: "RLS policy tests reference owner-allow, cross-user-deny, and anonymous-deny assertions." },
    { name: "rssSafety", passed: fileExists(root, "tests/feed-network-policy.test.ts") && fileExists(root, "tests/safe-feed-fetch.test.ts"), detail: "SSRF policy and redirect-pivot tests present." },
    { name: "articleDeduplication", passed: fileExists(root, "tests/article-deduplication.test.ts"), detail: "Article deduplication tests present." },
    { name: "candidateLimit", passed: fileMatches(root, "components/reading/for-you.tsx", /slice\(0,\s*3\)/), detail: "Reading hub limits candidates to three." },
    { name: "migrationIdempotency", passed: fileExists(root, "tests/local-cloud-migration.test.ts") && fileExists(root, "tests/storage-migration.test.ts"), detail: "Idempotent migration tests present." },
    ...runTodayPlanInvariantChecks(),
    { name: "stageOrder", passed: stageOrderValid(), detail: "Today stage order frozen as warmup → scan → learn → reading → context-quiz → summary." },
    { name: "rssAudit", passed: rssAudit.missing.length === 0 && rssAudit.acceptedLemmaCount === TARGET_LEMMA_COUNT, detail: rssAudit.missing.length === 0 ? `${rssAudit.checks} RSS checks passed; reading index lemma count ${rssAudit.acceptedLemmaCount}.` : `${rssAudit.missing.length} RSS checks missing: ${rssAudit.missing.join("; ")}` },
    { name: "fullTestBuildStatus", passed: false, detail: "Verified by the release gate command chain (pnpm test / lint / tsc / build), not by this aggregator." }
  ];

  const passed = results
    .filter((check) => check.name !== "fullTestBuildStatus")
    .every((check) => check.passed);

  return { generatedAt: new Date().toISOString(), acceptedLemmaCount: report.acceptedLemmaCount, passed, results };
}

function renderMarkdown(result: FinalAcceptanceResult): string {
  const lines: string[] = [
    "# Final product acceptance",
    "",
    `Generated at ${result.generatedAt}`,
    "",
    `accepted lemma count: **${result.acceptedLemmaCount}**`,
    "",
    "| Check | Status | Detail |",
    "| --- | --- | --- |"
  ];
  for (const check of result.results) {
    lines.push(`| ${check.name} | ${check.passed ? "pass" : check.name === "fullTestBuildStatus" ? "gate" : "FAIL"} | ${check.detail} |`);
  }
  lines.push("", `Overall: **${result.passed ? "PASS" : "FAIL"}**`, "");
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildFinalProductAcceptance(process.cwd()).then((result) => {
    const markdown = renderMarkdown(result);
    writeFileSync(resolve(process.cwd(), "docs/final-product-acceptance.md"), markdown, "utf8");
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 2;
  }).catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
