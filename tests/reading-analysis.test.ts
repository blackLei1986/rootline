import { describe, expect, it } from "vitest";
import { analyzeReadingDocument, scoreDocumentForUser } from "@/lib/reading/analyze";
import { lemmatize } from "@/lib/reading/lemmatize";
import { tokenize } from "@/lib/reading/tokenize";
import { vocabularyIndex } from "@/lib/vocabulary-index";
import { EMPTY_STORAGE, createWordProgress } from "@/lib/storage";
import { applyVerificationResult } from "@/lib/recognition-progress";

const storage = () => structuredClone(EMPTY_STORAGE);

describe("reading analysis", () => {
  it("tokenizes punctuation, contractions, hyphens and numbers with offsets", () => {
    const text = "Studies aren't one-size-fits-all in 2026.";
    const result = tokenize(text);
    expect(result.map((token) => token.token)).toEqual(["Studies", "aren't", "one-size-fits-all", "in", "2026"]);
    expect(text.slice(result[0].start, result[0].end)).toBe("Studies");
  });

  it("lemmatizes irregular and inflected vocabulary forms", () => {
    expect(lemmatize("studies", vocabularyIndex)).toBe("study");
    expect(lemmatize("shown", vocabularyIndex)).toBe("show");
    expect(lemmatize("predictions", vocabularyIndex)).toBe("prediction");
  });

  it("keeps untracked separate from explicitly unknown", () => {
    const progress = storage();
    progress.words.significant = { ...createWordProgress("significant"), recognitionState: "unknown", recognitionCount: 1 };
    const document = analyzeReadingDocument({ text: "A significant prediction can influence perspective.", sourceType: "academic", storage: progress });
    expect(document.vocabulary.find((item) => item.wordId === "significant")?.knowledgeState).toBe("unknown");
    expect(document.vocabulary.find((item) => item.wordId === "prediction")?.knowledgeState).toBe("untracked");
  });

  it("filters proper nouns and numbers from vocabulary gaps", () => {
    const document = analyzeReadingDocument({ text: "Researchers in Tokyo studied Amazon data from 2026.", sourceType: "news", storage: storage() });
    expect(document.tokens.find((token) => token.token === "Tokyo")?.status).toBe("proper-noun");
    expect(document.tokens.find((token) => token.token === "Amazon")?.status).toBe("proper-noun");
    expect(document.tokens.find((token) => token.token === "2026")?.status).toBe("number");
  });

  it("prefers the longest phrase match and counts duplicate occurrences", () => {
    const document = analyzeReadingDocument({ text: "Evidence can have a significant impact. A significant impact can influence policy.", sourceType: "ielts", storage: storage() });
    expect(document.phrases.some((phrase) => phrase.text === "significant impact")).toBe(true);
    expect(document.vocabulary.find((item) => item.wordId === "significant")?.occurrences).toBe(2);
  });

  it("calculates personalized coverage and ranks repeated gaps", () => {
    const progress = storage();
    progress.words.significant = { ...createWordProgress("significant"), recognitionState: "known", recognitionCount: 1, firstLearnedAt: "2026-01-01T00:00:00.000Z" };
    const document = analyzeReadingDocument({ text: "Significant evidence supports a significant prediction and a fresh perspective.", sourceType: "toefl", storage: progress });
    expect(document.coverage.contentWordCoverage).toBeGreaterThan(0);
    expect(document.vocabulary[0].recommendationScore).toBeGreaterThanOrEqual(document.vocabulary.at(-1)!.recommendationScore);
    expect(["too-easy", "comfortable", "challenge", "too-hard"]).toContain(scoreDocumentForUser(document));
  });

  it("raises article coverage after a correct contextual verification", () => {
    const progress = storage();
    progress.words.significant = { ...createWordProgress("significant"), recognitionState: "unknown", recognitionCount: 1, firstLearnedAt: "2026-01-01T00:00:00.000Z" };
    const before = analyzeReadingDocument({ text: "A significant impact can influence a prediction.", sourceType: "academic", storage: progress });
    progress.words.significant = applyVerificationResult(progress.words.significant, true);
    const after = analyzeReadingDocument({ text: "A significant impact can influence a prediction.", sourceType: "academic", storage: progress });
    expect(after.coverage.contentWordCoverage).toBeGreaterThan(before.coverage.contentWordCoverage);
  });

  it.each(["general", "ielts", "toefl", "academic", "news"] as const)("analyzes a %s fixture deterministically", (sourceType) => {
    const document = analyzeReadingDocument({ text: "Evidence supports a significant prediction. Tokyo reported 2026 results.", sourceType, storage: storage() });
    expect(document.sourceType).toBe(sourceType);
    expect(document.analysisVersion).toBe("1.0.0");
    expect(document.wordCount).toBeGreaterThan(5);
    expect(document.unknownDensity).toBeLessThanOrEqual(100);
  });
});
