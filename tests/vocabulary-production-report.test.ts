import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { words } from "@/data/words";
import { ACCEPTED_LEMMA_TARGET_MAX, createFullVocabularyProductionReport, createVocabularyProductionReport, isWithinAcceptedLemmaTarget, passesAcceptedMinimum } from "@/lib/vocabulary-production-report";
import { computeProductionTierTargets } from "@/lib/vocabulary-production-plan";
import type { ProductionVocabularyEntry } from "@/types";

describe("vocabulary production report", () => {
  it("allows the master vocabulary target to reach approximately 10,000 accepted lemmas", () => {
    expect(ACCEPTED_LEMMA_TARGET_MAX).toBe(10_000);
    expect(isWithinAcceptedLemmaTarget(9_750)).toBe(true);
    expect(isWithinAcceptedLemmaTarget(10_001)).toBe(false);
  });

  it("counts only unique accepted lemmas that pass every minimum field gate", () => {
    const accepted = words.filter(passesAcceptedMinimum);
    const report = createVocabularyProductionReport(words);
    expect(report.acceptedLemmaCount).toBe(new Set(accepted.map((word) => word.lemma.toLowerCase())).size);
    expect(report.totalRecords).toBe(words.length);
    expect(report.totalLemmas).toBeLessThanOrEqual(report.totalSurfaceForms);
  });

  it("does not confuse raw records with final-gate acceptance", () => {
    const report = createVocabularyProductionReport(words);
    expect(report.finalGatePassed).toBe(report.acceptedLemmaCount >= 8_000);
    expect(report.tierCounts["tier-1-core"] + report.tierCounts["tier-2-important"] + report.tierCounts["tier-3-recognition"] + report.tierCounts["tier-4-extension"]).toBe(report.acceptedLemmaCount);
  });

  it("recomputes the production gate from all deployed vocabulary shards", () => {
    const directory = resolve(process.cwd(), "public/vocabulary-data");
    const catalog = readdirSync(directory)
      .filter((file) => /^[a-z]\.json$/.test(file))
      .sort()
      .flatMap((file) => JSON.parse(readFileSync(resolve(directory, file), "utf8")) as ProductionVocabularyEntry[]);
    const report = createFullVocabularyProductionReport(catalog);
    const searchIndex = JSON.parse(readFileSync(resolve(directory, "index.json"), "utf8")) as unknown[];
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "data/vocabulary/production-manifest.json"), "utf8")) as { target: number; acceptedLemmaCount: number; wordFamilyCount: number };

    expect(manifest.target).toBeGreaterThanOrEqual(8_500);
    expect(manifest.target).toBeLessThanOrEqual(ACCEPTED_LEMMA_TARGET_MAX);
    expect(report.acceptedLemmaCount).toBe(manifest.acceptedLemmaCount);
    expect(report.totalRecords).toBe(manifest.acceptedLemmaCount);
    expect(report.totalLemmas).toBe(manifest.acceptedLemmaCount);
    expect(report.totalWordFamilies).toBe(manifest.wordFamilyCount);
    expect(report.totalWordFamilies).toBeLessThan(report.totalLemmas);
    expect(Object.values(report.tierCounts).reduce((sum, count) => sum + count, 0)).toBe(manifest.acceptedLemmaCount);
    expect(report.tierCounts).toEqual(computeProductionTierTargets(manifest.target));
    expect(report.needsReview).toEqual([]);
    expect(report.duplicateCandidates).toEqual([]);
    expect(report.tierDepthIssues).toEqual([]);
    expect(searchIndex).toHaveLength(manifest.acceptedLemmaCount);
    expect(report.finalGatePassed).toBe(true);
    expect(report.targetGatePassed).toBe(true);
  });
});
