import { describe, expect, it } from "vitest";
import { buildSummaryTokens } from "@/lib/reading/daily-reading-highlights";
import { buildReinforcementQuestions, gradeReinforcementAnswer } from "@/lib/reading/reinforcement/questions";
import type { DailyReadingArticleWord } from "@/components/reading/daily-reading-article";
import { createWordProgress } from "@/lib/storage";

function word(id: string, meaning: string, level: DailyReadingArticleWord["level"] = "recent-7-day", forms = [id]): DailyReadingArticleWord {
  return {wordId: id, word: id, lemma: id, surfaceForms: forms, level,
    coreMeaningZh: meaning, coreDefinitionEn: meaning, morphology: null};
}

function input(summary: string, words: DailyReadingArticleWord[], todayWordIds: string[] = []) {
  return {
    articleId: "article-1", summary, words, todayWordIds,
    recentWordIds: words.map((item) => item.wordId).filter((id) => !todayWordIds.includes(id)),
    openedWordIds: [] as string[], progressByWordId: {},
    summaryTokens: buildSummaryTokens(summary, words, words.map((item) => ({lemma: item.lemma, surfaceForms: item.surfaceForms ?? []})))
  };
}

describe("summary-grounded reinforcement questions", () => {
  it("omits a target not actually highlighted in the displayed summary", () => {
    const words = [word("adapt", "适应")];
    expect(buildReinforcementQuestions(input("The method changed.", words))).toEqual([]);
  });

  it("freezes three distinct context modes when three safe targets exist", () => {
    const words = [word("adapt", "适应", "today"), word("analyze", "分析"), word("explain", "解释")];
    const summary = "Researchers adapt methods, analyze results, and explain findings.";
    const result = buildReinforcementQuestions(input(summary, words, ["adapt"]));
    expect(result).toHaveLength(3);
    expect(result.map((item) => item.type)).toEqual(["recognition", "cloze", "recall"]);
    expect(result[0]?.wordId).toBe("adapt");
    expect(new Set(result.map((item) => item.wordId))).toEqual(new Set(["adapt", "analyze", "explain"]));
    expect(summary.includes(result[0]!.context)).toBe(true);
    expect(result[1]!.context).toContain("____");
    expect(summary.includes(result[2]!.context)).toBe(true);
  });

  it("uses the displayed inflected surface as the only Cloze answer", () => {
    const words = [word("adapt", "适应", "today", ["adapt", "adapted"]), word("analyze", "分析")];
    const result = buildReinforcementQuestions(input("They analyze how teams adapted quickly.", words, ["adapt"]));
    const cloze = result.find((item) => item.type === "cloze");
    expect(cloze?.wordId).toBe("adapt");
    expect(cloze?.context).toContain("____");
    expect(gradeReinforcementAnswer(cloze!, "ADAPTED")).toBe(true);
    expect(gradeReinforcementAnswer(cloze!, "adapt")).toBe(false);
  });

  it("caps selection at five, prioritizes Today, and is stable across calls", () => {
    const words = ["adapt", "analyze", "explain", "compare", "inspect", "derive"].map((id, index) =>
      word(id, `含义${index}`, index < 2 ? "today" : "recent-7-day"));
    const fixture = input("Teams adapt, analyze, explain, compare, inspect, and derive conclusions.", words, ["adapt", "analyze"]);
    const first = buildReinforcementQuestions(fixture);
    expect(first).toHaveLength(5);
    expect(new Set(first.map((item) => item.wordId)).size).toBe(5);
    expect(first.slice(0, 2).map((item) => item.wordId).sort()).toEqual(["adapt", "analyze"]);
    expect(buildReinforcementQuestions(fixture)).toEqual(first);
  });

  it("ranks a weak recent word ahead of an ordinary recent word", () => {
    const words = [word("adapt", "适应"), word("analyze", "分析"), word("explain", "解释")];
    const fixture = input("They adapt methods, analyze results, and explain findings.", words);
    fixture.progressByWordId = {explain: {...createWordProgress("explain"), wrongCount: 2}};
    expect(buildReinforcementQuestions(fixture)[0]?.wordId).toBe("explain");
  });

  it("does not invent a root hint for a Support word or accept duplicate meanings as distractors", () => {
    const support = {...word("adapt", "适应", "today"), rootForm: "apt", morphology: null};
    const duplicate = word("analyze", "适应");
    const result = buildReinforcementQuestions(input("They adapt and analyze.", [support, duplicate], ["adapt"]));
    expect(result.some((item) => item.explanation?.includes("apt"))).toBe(false);
    expect(result.some((item) => item.type === "recognition")).toBe(false);
  });
});
