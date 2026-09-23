import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildFinalProductAcceptance, passesFinalVocabularyGate, runTodayPlanInvariantChecks } from "@/scripts/final-product-acceptance";

const REQUIRED_NAMES = [
  "acceptedLemmaCount",
  "vocabularyGate",
  "accountFlow",
  "rls",
  "rssSafety",
  "articleDeduplication",
  "candidateLimit",
  "migrationIdempotency",
  "todayArticleCount",
  "fiveQuestions",
  "eligiblePlanStages",
  "degradation",
  "stageOrder",
  "rssAudit",
  "fullTestBuildStatus"
];

describe("final product acceptance", () => {
  it("requires the configured vocabulary target gate, not just the final minimum", () => {
    const report = { finalGatePassed: true, targetGatePassed: false, duplicateCandidates: [], tierDepthIssues: [] };
    expect(passesFinalVocabularyGate(report)).toBe(false);
    expect(passesFinalVocabularyGate({ ...report, targetGatePassed: true })).toBe(true);
  });

  it("produces every named acceptance result", async () => {
    const result = await buildFinalProductAcceptance(process.cwd());
    const names = result.results.map((check) => check.name);
    for (const required of REQUIRED_NAMES) {
      expect(names, `missing result ${required}`).toContain(required);
    }
  });

  it("recalculates accepted lemma count from deployed shards and passes every prerequisite audit", async () => {
    const result = await buildFinalProductAcceptance(process.cwd());
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "data/vocabulary/production-manifest.json"), "utf8")) as { acceptedLemmaCount: number };
    expect(result.acceptedLemmaCount).toBe(manifest.acceptedLemmaCount);
    expect(result.results.find((check) => check.name === "fullTestBuildStatus")?.passed).toBe(false);
    for (const check of result.results) {
      if (check.name === "fullTestBuildStatus") continue;
      expect({ name: check.name, detail: check.detail }).toMatchObject({ name: check.name });
      expect(check.passed, `${check.name}: ${check.detail}`).toBe(true);
    }
    expect(result.passed).toBe(true);
  });

  it("enforces zero-or-one article and exactly five questions for eligible plans", () => {
    const checks = runTodayPlanInvariantChecks();
    const byName = Object.fromEntries(checks.map((check) => [check.name, check]));
    expect(byName.todayArticleCount.passed).toBe(true);
    expect(byName.fiveQuestions.passed).toBe(true);
    expect(byName.eligiblePlanStages.passed).toBe(true);
    expect(byName.degradation.passed).toBe(true);
  });
});
