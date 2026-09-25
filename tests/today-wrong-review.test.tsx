import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {Daily30Flow} from "@/components/today/daily-30-flow";
import type {TodayPlanDTO, TodaySessionDTO} from "@/types/today";

const plan = {id: "550e8400-e29b-41d4-a716-446655440000", date: "2026-09-25", version: 1,
  status: "active", estimatedMinutes: 20, warmupReviewIds: [], warmupReviewEntries: [], rapidScanEntries: [],
  focusedLearningTarget: 0, sentenceTarget: 0, quizTarget: 0, readingCandidateIds: [],
  mix: {review: 0, newVocabulary: 100, reading: 0, sentence: 0}, article: null, contextQuestions: [],
  stages: ["learn", "summary"], degradationReason: null,
  dailyTargets: [{wordId: "inspect", word: "inspect", lemma: "inspect", coreMeaningZh: "检查", coreDefinitionEn: "examine",
    partOfSpeech: ["verb"], example: "Inspect it.", examples: ["Inspect it."], source: "support", rootId: null,
    rootForm: null, rootMeaningEn: [], rootMeaningZh: [], rootExplanation: null, familyId: null, morphology: null,
    block: 1, position: 0}]} as TodayPlanDTO;

function session(final: boolean, answered = false): TodaySessionDTO {
  return {planId: plan.id, status: "active", currentStage: "learn", completedQuestionIds: [], currentBlock: 1,
    completedTargetIds: ["inspect"], targetProgress: {inspect: {targetId: "inspect", block: 1, status: "complete",
      currentActivity: null, recognitionState: "unknown", outcomes: {}}},
    completedMiniReviewBlocks: final ? [1] : [], finalReviewComplete: false,
    reviewAccuracy: {correct: 0, total: answered ? 1 : 0},
    reviewAnswers: answered ? {[`${final ? "final" : "mini"}:inspect`]: false} : {}, eventRevision: answered ? 2 : 1};
}

afterEach(() => {cleanup(); vi.unstubAllGlobals();});

describe.each([["mini", false], ["final", true]] as const)("wrong %s review", (_label, final) => {
  it("advances after a persisted false answer and survives refresh", async () => {
    const fetchMock = vi.fn(async (_input: string, init?: RequestInit) => ({ok: true,
      json: async () => session(final, init?.method === "POST")}));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Daily30Flow plan={plan} />);
    await waitFor(() => expect(screen.getByRole("button", {name: "继续今日学习"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name: "继续今日学习"}));
    fireEvent.click(screen.getByRole("button", {name: "没想起来"}));
    expect(await screen.findByRole("button", {name: final ? "完成今日计划" : "继续下一个 Block"})).toBeVisible();
    view.unmount();
    vi.stubGlobal("fetch", vi.fn(async () => ({ok: true, json: async () => session(final, true)})));
    render(<Daily30Flow plan={plan} />);
    await waitFor(() => expect(screen.getByRole("button", {name: "继续今日学习"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name: "继续今日学习"}));
    expect(screen.getByRole("button", {name: final ? "完成今日计划" : "继续下一个 Block"})).toBeVisible();
  });
});
