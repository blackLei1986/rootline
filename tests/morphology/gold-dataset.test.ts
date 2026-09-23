import { describe, expect, it } from "vitest";
import {
  createGoldDatasetV1,
  createGoldDatasetV2,
  createGoldDatasetV3
} from "@/lib/morphology/gold-dataset";

describe("createGoldDatasetV1", () => {
  it("projects the curated roots and words into a stable versioned Gold Dataset", () => {
    const first = createGoldDatasetV1();
    const second = createGoldDatasetV1();

    expect(first.version).toBe("gold-v1");
    expect(first.source).toBe("rootline-curated-static");
    expect(new Set(first.roots.map((root) => root.rootKey)).size).toBe(20);
    expect(first.words).toHaveLength(150);
    expect(first.words.filter((word) => word.rootIds.length > 0)).toHaveLength(149);
    expect(first.provenance.sourcePaths).toEqual(["data/roots.ts", "data/words.ts"]);
    expect(first.provenance.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(second.provenance.contentHash).toBe(first.provenance.contentHash);
  });

  it("preserves the curated inspect teaching relation without mutating it", () => {
    const dataset = createGoldDatasetV1();
    const inspect = dataset.words.find((word) => word.lemma === "inspect");

    expect(inspect).toMatchObject({
      word: "inspect",
      rootIds: ["spect"],
      prefix: { form: "in-", meaning: "into" },
      formationExplanation: "look into"
    });
  });

  it("keeps v1 immutable while v2 adds evidence-backed roots, variants, and lexical families", () => {
    const v1 = createGoldDatasetV1();
    const v2 = createGoldDatasetV2();

    expect(v1.version).toBe("gold-v1");
    expect(v1.roots).toHaveLength(20);
    expect(v1.words).toHaveLength(150);
    expect(v2.version).toBe("gold-v2");
    expect(v2.roots.length).toBeGreaterThanOrEqual(45);
    expect(v2.roots.length).toBeLessThanOrEqual(50);
    expect(v2.words.length).toBeGreaterThanOrEqual(400);
    expect(v2.words.length).toBeLessThanOrEqual(600);
    expect(v2.roots.find((root) => root.rootKey === "cap")?.variants)
      .toContainEqual(expect.objectContaining({ form: "cept", relation: "historical" }));
    expect(v2.words.find((word) => word.wordId === "v2:action")?.lexicalFamily?.key)
      .toBe("act:action");
  });

  it("keeps v2 immutable while v3 adds unique explicitly-provenanced depth", () => {
    const v2 = createGoldDatasetV2();
    const v3 = createGoldDatasetV3();
    expect(v3.version).toBe("gold-v3");
    expect(v3.roots.length).toBeGreaterThan(v2.roots.length);
    expect(v3.words.length).toBeGreaterThan(v2.words.length + 100);
    expect(new Set(v3.words.map((word) => word.wordId)).size).toBe(v3.words.length);
    expect(v3.words.filter((word) => word.wordId.startsWith("v3:")).every((word) => (
      word.lexicalFamily?.key.startsWith(`${word.rootIds[0]}:`)
      && word.provenance?.[0]?.sourceUrl.startsWith("https://")
    ))).toBe(true);
  });
});
