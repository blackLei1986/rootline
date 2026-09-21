import { describe, expect, it } from "vitest";
import { createGoldDatasetV1 } from "@/lib/morphology/gold-dataset";

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
});
