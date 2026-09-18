import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { words } from "@/data/words";
import { createFullVocabularyProductionReport, createVocabularyProductionReport, passesAcceptedMinimum } from "@/lib/vocabulary-production-report";
import type { ProductionVocabularyEntry } from "@/types";

describe("vocabulary production report", () => {
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
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "data/vocabulary/production-manifest.json"), "utf8")) as { wordFamilyCount: number };

    expect(report.acceptedLemmaCount).toBe(9_000);
    expect(report.totalRecords).toBe(9_000);
    expect(report.totalLemmas).toBe(9_000);
    expect(report.totalWordFamilies).toBe(manifest.wordFamilyCount);
    expect(report.totalWordFamilies).toBeLessThan(report.totalLemmas);
    expect(Object.values(report.tierCounts).reduce((sum, count) => sum + count, 0)).toBe(9_000);
    expect(report.tierCounts).toEqual({
      "tier-1-core": 2_200,
      "tier-2-important": 2_800,
      "tier-3-recognition": 3_000,
      "tier-4-extension": 1_000
    });
    expect(report.needsReview).toEqual([]);
    expect(report.duplicateCandidates).toEqual([]);
    expect(report.tierDepthIssues).toEqual([]);
    expect(searchIndex).toHaveLength(9_000);
    expect(report.finalGatePassed).toBe(true);
    expect(report.targetGatePassed).toBe(true);
  });
});
