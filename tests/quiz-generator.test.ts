import { describe, expect, it } from "vitest";
import { roots } from "../data/roots";
import { getWordById } from "../data/words";
import { generateQuiz, isQuizAnswerCorrect } from "../lib/quiz-generator";
import type { QuizMode } from "../types/quiz";

const spect = roots.find((root) => root.id === "spect")!;
const inspect = getWordById("inspect")!;

describe("generateQuiz", () => {
  it.each([
    "root-to-meaning",
    "word-to-meaning",
    "meaning-to-word",
    "morphology-to-word",
    "word-to-root"
  ] satisfies QuizMode[])("generates %s", (mode) => {
    const question = generateQuiz({ word: inspect, root: spect, mode, random: () => 0.5 });
    expect(question.prompt).toBeTruthy();
    expect(question.answer).toBeTruthy();
    expect(question.explanation).toContain(mode === "root-to-meaning" ? "spect" : "inspect");
  });

  it("uses real data for multiple-choice distractors", () => {
    const question = generateQuiz({ word: inspect, root: spect, mode: "word-to-meaning", random: () => 0.5 });
    expect(question.options).toContain("检查");
    expect(question.options?.every((option) => option.length > 0)).toBe(true);
  });
});

describe("isQuizAnswerCorrect", () => {
  it("ignores case and surrounding whitespace", () => {
    const question = generateQuiz({ word: inspect, root: spect, mode: "meaning-to-word" });
    expect(isQuizAnswerCorrect(question, "  INSPECT ")).toBe(true);
    expect(isQuizAnswerCorrect(question, "respect")).toBe(false);
  });
});
