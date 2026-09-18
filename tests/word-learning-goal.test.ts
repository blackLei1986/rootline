import { describe, expect, it } from "vitest";
import { makeWord } from "@/data/word-factory";
import { getWordById } from "@/data/words";

describe("word learning goals", () => {
  it("marks a high-value academic adjective for active use", () => {
    const word = getWordById("significant");

    expect(word?.learningGoal).toBe("active-use");
    expect(word?.activePriority).toBeGreaterThanOrEqual(80);
  });

  it("keeps low-frequency advanced vocabulary recognition-first", () => {
    const word = makeWord({
      word: "testaceous",
      partOfSpeech: ["adjective"],
      meaningZh: ["砖红色的"],
      meaningEn: ["having a brick-red color"],
      frequency: "low",
      rootIds: [],
      morphology: "testaceous",
      literalMeaning: "brick-red",
      rootTier: "advanced"
    });

    expect(word.learningGoal).toBe("recognition");
    expect(word.activePriority).toBe(0);
  });
});
