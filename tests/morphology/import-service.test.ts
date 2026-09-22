import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createGoldDatasetV1,
  createGoldDatasetV2
} from "@/lib/morphology/gold-dataset";
import {
  buildMorphologyImportPlan,
  type PersistedMorphologyState
} from "@/lib/morphology/import-service";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

const emptyState: PersistedMorphologyState = {
  datasets: [],
  roots: [],
  families: [],
  records: []
};

async function productionVocabulary(): Promise<ProductionVocabularyEntry[]> {
  return JSON.parse(
    await readFile(resolve(process.cwd(), "data/vocabulary/production-catalog.json"), "utf8")
  ) as ProductionVocabularyEntry[];
}

function appliedStateFrom(plan: ReturnType<typeof buildMorphologyImportPlan>): PersistedMorphologyState {
  return {
    datasets: [{
      id: "00000000-0000-4000-8000-000000000001",
      version: plan.payload.dataset.version,
      contentHash: plan.payload.dataset.provenance.contentHash
    }],
    roots: plan.payload.roots.map((root, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
      datasetVersion: plan.payload.dataset.version,
      rootKey: root.rootKey,
      contentHash: root.contentHash
    })),
    families: plan.payload.families.map((family, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 500).padStart(12, "0")}`,
      datasetVersion: plan.payload.dataset.version,
      familyKey: family.familyKey,
      contentHash: family.contentHash
    })),
    records: plan.payload.records.map((record, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1000).padStart(12, "0")}`,
      datasetVersion: plan.payload.dataset.version,
      catalogWordId: record.catalogWordId,
      source: record.source,
      confidence: record.confidence,
      reviewStatus: record.reviewStatus,
      contentHash: record.contentHash,
      segmentCount: record.segments.length,
      rootRelationCount: record.segments.filter((segment) => segment.kind === "root").length,
      hasFamilyRelation: record.familyKey !== null
    }))
  };
}

describe("buildMorphologyImportPlan", () => {
  it("builds the complete atomic Gold and exact-derived payload from the production catalog", async () => {
    const plan = buildMorphologyImportPlan({
      dataset: createGoldDatasetV1(),
      vocabulary: await productionVocabulary(),
      persisted: emptyState
    });

    expect(plan.errors).toEqual([]);
    expect(plan.summary).toMatchObject({
      goldRoots: { insert: 20, update: 0, unchanged: 0 },
      goldWords: { insert: 150, update: 0, unchanged: 0 },
      derivedCandidates: {
        insert: 123,
        update: 0,
        unchanged: 0,
        verifiedConflicts: 0,
        rejectedConflicts: 0
      },
      auditEvents: { create: 274, unchanged: 0 }
    });

    const goldContradiction = plan.payload.records.find(
      (record) => record.catalogWordId === "gold:contradiction"
    );
    expect(goldContradiction).toMatchObject({
      word: "contradiction",
      lemma: "contradict",
      source: "gold-dataset",
      confidence: "verified",
      reviewStatus: "approved",
      morphologyExpression: "contra + dict + ion",
      literalMeaning: "a speaking against",
      familyKey: "gold:contradiction",
      primaryRootKey: "dict"
    });
    expect(goldContradiction?.segments).toEqual([
      expect.objectContaining({ position: 0, kind: "prefix", surfaceForm: "contra-", normalizedForm: "contra-" }),
      expect.objectContaining({ position: 1, kind: "root", surfaceForm: "dict", normalizedForm: "dict", rootKey: "dict" }),
      expect.objectContaining({ position: 2, kind: "suffix", surfaceForm: "-ion", normalizedForm: "-ion" })
    ]);

    const derivedInspect = plan.payload.records.find(
      (record) => record.catalogWordId === "inspect" && record.source === "gold-dataset-exact-lemma"
    );
    expect(derivedInspect).toMatchObject({
      confidence: "derived",
      reviewStatus: "pending",
      morphologyScore: 100,
      provenance: expect.objectContaining({
        sourceLemma: "inspect",
        datasetVersion: "gold-v1",
        matchingRule: "exact-lemma"
      })
    });
  });

  it("reports an identical second import as unchanged and creates no duplicate audit events", async () => {
    const dataset = createGoldDatasetV1();
    const vocabulary = await productionVocabulary();
    const first = buildMorphologyImportPlan({ dataset, vocabulary, persisted: emptyState });
    const second = buildMorphologyImportPlan({
      dataset,
      vocabulary,
      persisted: appliedStateFrom(first)
    });

    expect(second.errors).toEqual([]);
    expect(second.summary.goldRoots).toEqual({ insert: 0, update: 0, unchanged: 20 });
    expect(second.summary.goldWords).toEqual({ insert: 0, update: 0, unchanged: 150 });
    expect(second.summary.derivedCandidates).toMatchObject({ insert: 0, update: 0, unchanged: 123 });
    expect(second.summary.auditEvents).toEqual({ create: 0, unchanged: 274 });
  });

  it("never downgrades verified records or recreates same-version rejected candidates", () => {
    const dataset = createGoldDatasetV1();
    const vocabulary = [
      { id: "inspect", word: "inspect", lemma: "inspect", wordFamilyId: "legacy-inspect" },
      { id: "respect", word: "respect", lemma: "respect", wordFamilyId: "legacy-respect" }
    ] as ProductionVocabularyEntry[];
    const persisted: PersistedMorphologyState = {
      ...emptyState,
      records: [
        {
          id: "00000000-0000-4000-8000-000000000010",
          datasetVersion: "gold-v0",
          catalogWordId: "inspect",
          source: "manual-review",
          confidence: "verified",
          reviewStatus: "approved",
          contentHash: "reviewed",
          segmentCount: 2,
          rootRelationCount: 1,
          hasFamilyRelation: true
        },
        {
          id: "00000000-0000-4000-8000-000000000011",
          datasetVersion: "gold-v1",
          catalogWordId: "respect",
          source: "gold-dataset-exact-lemma",
          confidence: "none",
          reviewStatus: "rejected",
          contentHash: "rejected",
          segmentCount: 2,
          rootRelationCount: 1,
          hasFamilyRelation: true
        }
      ]
    };

    const plan = buildMorphologyImportPlan({ dataset, vocabulary, persisted });

    expect(plan.summary.derivedCandidates).toMatchObject({
      insert: 0,
      verifiedConflicts: 1,
      rejectedConflicts: 1
    });
    expect(plan.payload.records.filter((record) => record.source === "gold-dataset-exact-lemma")).toEqual([]);
  });

  it("requires a new version when the same version has a different content hash", () => {
    const dataset = createGoldDatasetV1();
    const plan = buildMorphologyImportPlan({
      dataset,
      vocabulary: [],
      persisted: {
        ...emptyState,
        datasets: [{
          id: "00000000-0000-4000-8000-000000000001",
          version: "gold-v1",
          contentHash: "different-content"
        }]
      }
    });

    expect(plan.errors).toEqual([
      "Dataset version gold-v1 already exists with a different content hash; create a new dataset version."
    ]);
  });

  it("projects only exact v2 lemmas and keeps verified production records stronger than derived", () => {
    const plan = buildMorphologyImportPlan({
      dataset: createGoldDatasetV2(),
      vocabulary: [
        { id: "action", word: "action", lemma: "action", wordFamilyId: "legacy-action" },
        { id: "noise", word: "enactmentish", lemma: "enactmentish", wordFamilyId: "noise" },
        { id: "active", word: "active", lemma: "active", wordFamilyId: "legacy-active" }
      ] as ProductionVocabularyEntry[],
      persisted: {
        ...emptyState,
        records: [{
          id: "00000000-0000-4000-8000-000000000012",
          datasetVersion: "gold-v1",
          catalogWordId: "active",
          source: "manual-review",
          confidence: "verified",
          reviewStatus: "approved",
          contentHash: "reviewed",
          segmentCount: 2,
          rootRelationCount: 1,
          hasFamilyRelation: true
        }]
      }
    });

    expect(plan.errors).toEqual([]);
    expect(plan.payload.records.find((record) => record.catalogWordId === "action" && record.source === "gold-dataset-exact-lemma"))
      .toMatchObject({ confidence: "derived", reviewStatus: "pending", familyKey: "act:action" });
    expect(plan.payload.records.some((record) => record.catalogWordId === "noise")).toBe(false);
    expect(plan.payload.records.some((record) => record.catalogWordId === "active" && record.source === "gold-dataset-exact-lemma")).toBe(false);
  });
});
