import { describe, expect, it } from "vitest";
import { createTodayEventService, TodayEventConflictError, type TodayEventInput, type TodayEventStore } from "@/lib/today/events";
import type { TodayPlan, TodaySessionDTO } from "@/types/today";
import { selectFinalReviewTargets, selectMiniReviewTargets } from "@/lib/today/review-selection";

describe("Today events", () => {
  it("rejects a stale tab before attempting a duplicate target transition", async () => {
    const store = new MemoryEventStore(daily30Plan(1));
    const service = createTodayEventService(store);
    const started = await service.recordTodayEvent("user-1", input("start-stale", "today_started", "learn"));
    await store.applyEvent("user-1", input("other-tab", "today_started", "learn"), {...started, eventRevision: 1});
    await expect(service.recordTodayEvent("user-1", {...dailyInput("stale-recognition", "target_recognized",
      {targetId: "word-0", block: 1, recognitionState: "known"}), expectedRevision: 0}))
      .rejects.toBeInstanceOf(TodayEventConflictError);
  });
  it("persists a duplicate operation only once", async () => {
    const store = new MemoryEventStore(plan());
    const service = createTodayEventService(store);
    const event = input("op-start", "today_started", "warmup");

    const first = await service.recordTodayEvent("user-1", event);
    const second = await service.recordTodayEvent("user-1", event);

    expect(second).toEqual(first);
    expect(store.appliedOperations).toHaveLength(1);
  });

  it("confirms only an owned plan's applied operation", async () => {
    const service = createTodayEventService(new MemoryEventStore(plan()));
    expect(await service.wasTodayOperationApplied("user-1", PLAN_ID, "missing")).toBe(false);
    await service.recordTodayEvent("user-1", input("op-confirmed", "today_started", "warmup"));
    expect(await service.wasTodayOperationApplied("user-1", PLAN_ID, "op-confirmed")).toBe(true);
    await expect(service.wasTodayOperationApplied("user-2", PLAN_ID, "op-confirmed"))
      .rejects.toThrow("not found");
  });

  it("resumes at Reading after an article is opened", async () => {
    const store = new MemoryEventStore(plan());
    const service = createTodayEventService(store);
    await service.recordTodayEvent("user-1", input("start", "today_started", "warmup"));
    await service.recordTodayEvent("user-1", input("warmup", "stage_completed", "warmup"));
    await service.recordTodayEvent("user-1", input("scan", "stage_completed", "scan"));
    await service.recordTodayEvent("user-1", input("learn", "stage_completed", "learn"));
    await service.recordTodayEvent("user-1", input("open", "article_opened", "reading"));

    const resumed = await createTodayEventService(store).getTodaySession("user-1", PLAN_ID);
    expect(resumed).toMatchObject({ status: "active", currentStage: "reading" });
  });

  it("completes Today once after all five unique context questions", async () => {
    const store = new MemoryEventStore(plan());
    const service = createTodayEventService(store);
    await advanceToContext(service);
    let session: TodaySessionDTO | null = null;
    for (let index = 0; index < 5; index += 1) {
      session = await service.recordTodayEvent("user-1", {
        ...input(`answer-${index}`, "context_answered", "context-quiz"),
        questionId: `q-${index}`,
        correct: true
      });
    }
    const replayed = await service.recordTodayEvent("user-1", {
      ...input("answer-4", "context_answered", "context-quiz"),
      questionId: "q-4",
      correct: true
    });

    expect(session).toMatchObject({ status: "complete", currentStage: "summary" });
    expect(replayed.completedQuestionIds).toHaveLength(5);
    expect(store.completionWrites).toBe(1);
  });

  it("rejects events for another user's plan", async () => {
    const service = createTodayEventService(new MemoryEventStore(plan()));
    await expect(service.recordTodayEvent("user-2", input("foreign", "today_started", "warmup")))
      .rejects.toThrow("not found");
  });

  it("persists target recognition and ordered activities across a session reload", async () => {
    const dailyPlan = daily30Plan();
    const store = new MemoryEventStore(dailyPlan);
    const service = createTodayEventService(store);
    await service.recordTodayEvent("user-1", input("daily-start", "today_started", "learn"));
    await service.recordTodayEvent("user-1", dailyInput("recognize", "target_recognized", { targetId: "word-0", block: 1, recognitionState: "fuzzy" }));
    await service.recordTodayEvent("user-1", dailyInput("card", "target_activity_completed", { targetId: "word-0", block: 1, activity: "learning-card" }));
    await service.recordTodayEvent("user-1", dailyInput("association", "target_activity_completed", { targetId: "word-0", block: 1, activity: "association", correct: true }));

    const resumed = await createTodayEventService(store).getTodaySession("user-1", PLAN_ID);
    expect(resumed.targetProgress?.["word-0"]).toMatchObject({
      status: "active",
      currentActivity: "cloze",
      recognitionState: "fuzzy",
      outcomes: { association: true }
    });
  });

  it("lets recognized-known targets skip the learning card but keeps association and recall", async () => {
    const service = createTodayEventService(new MemoryEventStore(daily30Plan(1)));
    await service.recordTodayEvent("user-1", input("known-start", "today_started", "learn"));
    const recognized = await service.recordTodayEvent("user-1", dailyInput("known-recognize", "target_recognized", {
      targetId: "word-0", block: 1, recognitionState: "known"
    }));
    expect(recognized.targetProgress?.["word-0"].currentActivity).toBe("association");
  });

  it("requires every selected Mini Review recall prompt before advancing", async () => {
    const dailyPlan = daily30Plan(10);
    const service = createTodayEventService(new MemoryEventStore(dailyPlan));
    await service.recordTodayEvent("user-1", input("start", "today_started", "learn"));
    for (let index = 0; index < 10; index += 1) {
      const targetId = `word-${index}`;
      await service.recordTodayEvent("user-1", dailyInput(`recognize-${index}`, "target_recognized", {
        targetId, block: 1, recognitionState: "unknown"
      }));
      for (const activity of ["learning-card", "association", "cloze", "recall"] as const) {
        await service.recordTodayEvent("user-1", dailyInput(`${activity}-${index}`, "target_activity_completed", {
          targetId, block: 1, activity, correct: true
        }));
      }
    }
    await expect(service.recordTodayEvent("user-1", dailyInput("premature-mini", "mini_review_completed", { block: 1 })))
      .rejects.toThrow("selected recall prompts");
  });

  it("locks the plan after all blocks, reviews, and final completion", async () => {
    const dailyPlan = daily30Plan(1);
    const store = new MemoryEventStore(dailyPlan);
    const service = createTodayEventService(store);
    await service.recordTodayEvent("user-1", input("daily-start", "today_started", "learn"));
    await service.recordTodayEvent("user-1", dailyInput("recognize", "target_recognized", { targetId: "word-0", block: 1, recognitionState: "known" }));
    for (const activity of ["association", "cloze", "recall"] as const) {
      await service.recordTodayEvent("user-1", dailyInput(`activity-${activity}`, "target_activity_completed", {
        targetId: "word-0", block: 1, activity, correct: activity === "recall"
      }));
    }
    await answerReviewPrompts(service, dailyPlan, 1);
    await service.recordTodayEvent("user-1", dailyInput("mini-review", "mini_review_completed", { block: 1 }));
    const current = await service.getTodaySession("user-1", PLAN_ID);
    for (const reviewTarget of selectFinalReviewTargets(dailyPlan.dailyTargets!, current.targetProgress!)) {
      await service.recordTodayEvent("user-1", dailyInput(`final-answer-${reviewTarget.wordId}`, "review_answered", {
        targetId: reviewTarget.wordId, block: reviewTarget.block, reviewKind: "final", correct: true
      }));
    }
    await service.recordTodayEvent("user-1", dailyInput("final-review", "final_review_completed", {}));
    await service.recordTodayEvent("user-1", input("done", "today_completed", "summary"));

    const locked = await service.getTodaySession("user-1", PLAN_ID);
    expect(locked).toMatchObject({ status: "complete", currentStage: "summary", finalReviewComplete: true, completedTargetIds: ["word-0"] });
    await expect(service.recordTodayEvent("user-1", dailyInput("new-target", "target_recognized", { targetId: "word-0", block: 1, recognitionState: "unknown" })))
      .rejects.toThrow("already complete");
  });

  it("completes the full 30-target, three-block path and resumes persisted position", async () => {
    const dailyPlan = daily30Plan(30);
    const service = createTodayEventService(new MemoryEventStore(dailyPlan));
    await service.recordTodayEvent("user-1", input("daily-start", "today_started", "learn"));
    for (const block of [1, 2, 3] as const) {
      for (let index = (block - 1) * 10; index < block * 10; index += 1) {
        const targetId = `word-${index}`;
        await service.recordTodayEvent("user-1", dailyInput(`recognize-${index}`, "target_recognized", {
          targetId, block, recognitionState: index % 2 ? "known" : "fuzzy"
        }));
        const activities = index % 2 ? ["association", "cloze", "recall"] as const : ["learning-card", "association", "cloze", "recall"] as const;
        for (const activity of activities) {
          await service.recordTodayEvent("user-1", dailyInput(`${activity}-${index}`, "target_activity_completed", {
            targetId, block, activity, correct: activity !== "cloze"
          }));
        }
        const resumed = await service.getTodaySession("user-1", PLAN_ID);
        expect(resumed.completedTargetIds).toContain(targetId);
      }
      for (const reviewTarget of selectMiniReviewTargets(dailyPlan.dailyTargets!, block)) {
        await service.recordTodayEvent("user-1", dailyInput(`mini-answer-${block}-${reviewTarget.wordId}`, "review_answered", {
          targetId: reviewTarget.wordId, block, reviewKind: "mini", correct: true
        }));
      }
      const session = await service.recordTodayEvent("user-1", dailyInput(`mini-${block}`, "mini_review_completed", { block }));
      expect(session.completedMiniReviewBlocks).toContain(block);
    }
    const beforeFinal = await service.getTodaySession("user-1", PLAN_ID);
    for (const reviewTarget of selectFinalReviewTargets(dailyPlan.dailyTargets!, beforeFinal.targetProgress!)) {
      await service.recordTodayEvent("user-1", dailyInput(`final-answer-${reviewTarget.wordId}`, "review_answered", {
        targetId: reviewTarget.wordId, block: reviewTarget.block, reviewKind: "final", correct: false
      }));
    }
    await service.recordTodayEvent("user-1", dailyInput("final", "final_review_completed", {}));
    const complete = await service.recordTodayEvent("user-1", input("complete", "today_completed", "summary"));
    expect(complete).toMatchObject({ status: "complete", completedTargetIds: Array.from({ length: 30 }, (_, index) => `word-${index}`) });
    expect(complete.reviewAccuracy).toEqual({ correct: 69, total: 104 });
  });

  it("rejects target activities that do not belong to the frozen plan or skip a required activity", async () => {
    const service = createTodayEventService(new MemoryEventStore(daily30Plan()));
    await service.recordTodayEvent("user-1", input("daily-start", "today_started", "learn"));

    await expect(service.recordTodayEvent("user-1", dailyInput("foreign-target", "target_recognized", {
      targetId: "not-in-plan", block: 1, recognitionState: "unknown"
    }))).rejects.toThrow("not part of");
    await service.recordTodayEvent("user-1", dailyInput("recognize", "target_recognized", { targetId: "word-0", block: 1, recognitionState: "unknown" }));
    await expect(service.recordTodayEvent("user-1", dailyInput("skip", "target_activity_completed", {
      targetId: "word-0", block: 1, activity: "cloze", correct: false
    }))).rejects.toThrow("not valid");
  });
});

const PLAN_ID = "550e8400-e29b-41d4-a716-446655440000";

async function advanceToContext(service: ReturnType<typeof createTodayEventService>) {
  await service.recordTodayEvent("user-1", input("start", "today_started", "warmup"));
  await service.recordTodayEvent("user-1", input("warmup", "stage_completed", "warmup"));
  await service.recordTodayEvent("user-1", input("scan", "stage_completed", "scan"));
  await service.recordTodayEvent("user-1", input("learn", "stage_completed", "learn"));
  await service.recordTodayEvent("user-1", input("reading", "stage_completed", "reading"));
}

function input(operationId: string, type: TodayEventInput["type"], stage: TodayEventInput["stage"]): TodayEventInput {
  return { operationId, planId: PLAN_ID, type, stage, occurredAt: "2026-09-17T08:00:00.000Z" };
}

class MemoryEventStore implements TodayEventStore {
  readonly appliedOperations: string[] = [];
  completionWrites = 0;
  private session: TodaySessionDTO | null = null;
  private readonly operations = new Map<string, TodaySessionDTO>();

  constructor(private readonly storedPlan: TodayPlan) {}

  async getOwnedPlan(userId: string, planId: string): Promise<TodayPlan | null> {
    return userId === "user-1" && planId === this.storedPlan.id ? structuredClone(this.storedPlan) : null;
  }

  async getSession(userId: string, planId: string): Promise<TodaySessionDTO | null> {
    return userId === "user-1" && planId === this.storedPlan.id ? structuredClone(this.session) : null;
  }

  async getOperationResult(userId: string, operationId: string): Promise<TodaySessionDTO | null> {
    return userId === "user-1" ? structuredClone(this.operations.get(operationId) ?? null) : null;
  }

  async applyEvent(userId: string, event: TodayEventInput, next: TodaySessionDTO): Promise<TodaySessionDTO> {
    const existing = this.operations.get(event.operationId);
    if (existing) return structuredClone(existing);
    if (userId !== "user-1") throw new Error("owner mismatch");
    this.appliedOperations.push(event.operationId);
    if (next.status === "complete" && this.session?.status !== "complete") this.completionWrites += 1;
    this.session = structuredClone(next);
    this.operations.set(event.operationId, structuredClone(next));
    return structuredClone(next);
  }
}

function plan(): TodayPlan {
  return {
    id: PLAN_ID,
    date: "2026-09-17",
    version: 1,
    status: "not-started",
    estimatedMinutes: 22,
    warmupReviewIds: [],
    rapidScanEntries: [],
    focusedLearningTarget: 7,
    sentenceTarget: 7,
    quizTarget: 5,
    readingCandidateIds: [],
    mix: { review: 40, newVocabulary: 30, reading: 20, sentence: 10 },
    article: { articleId: "article-1", title: "Article", sourceTitle: "Source", canonicalUrl: "https://example.com/a", estimatedMinutes: 6, contentWordCoverage: 96, targetWordIds: [], selectionReasons: [] },
    contextQuestions: Array.from({ length: 5 }, (_, index) => ({ id: `q-${index}`, articleId: "article-1", sentence: "A ____ sentence.", targetWordId: `word-${index}`, prompt: "Meaning?", choices: ["yes", "no"], correctChoice: "yes" })),
    stages: ["warmup", "scan", "learn", "reading", "context-quiz", "summary"],
    degradationReason: null
  };
}

function daily30Plan(targetCount = 30): TodayPlan {
  const base = plan();
  return {
    ...base,
    article: null,
    contextQuestions: [],
    dailyTargets: Array.from({ length: targetCount }, (_, index) => ({
      wordId: `word-${index}`, word: `word${index}`, lemma: `word${index}`, coreMeaningZh: "含义", coreDefinitionEn: "meaning",
      partOfSpeech: ["noun"], example: "A sentence.", examples: ["A sentence."], source: "support" as const,
      rootId: null, rootForm: null, rootMeaningEn: [], rootMeaningZh: [], rootExplanation: null, familyId: null, morphology: null,
      block: Math.floor(index / 10) + 1 as 1 | 2 | 3, position: index
    })),
    stages: ["learn", "summary"]
  };
}

function dailyInput(
  operationId: string,
  type: "target_recognized" | "target_activity_completed" | "review_answered" | "mini_review_completed" | "final_review_completed",
  fields: { targetId?: string; block?: 1 | 2 | 3; recognitionState?: "known" | "fuzzy" | "unknown"; activity?: "learning-card" | "association" | "cloze" | "recall"; reviewKind?: "mini" | "final"; correct?: boolean }
): TodayEventInput {
  return { operationId, planId: PLAN_ID, type, stage: "learn", occurredAt: "2026-09-17T08:00:00.000Z", ...fields };
}

async function answerReviewPrompts(service: ReturnType<typeof createTodayEventService>, dailyPlan: TodayPlan, block: 1 | 2 | 3) {
  for (const reviewTarget of selectMiniReviewTargets(dailyPlan.dailyTargets!, block)) {
    await service.recordTodayEvent("user-1", dailyInput(`mini-answer-${reviewTarget.wordId}`, "review_answered", {
      targetId: reviewTarget.wordId, block, reviewKind: "mini", correct: true
    }));
  }
}
