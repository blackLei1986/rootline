import { describe, expect, it } from "vitest";
import { createTodayEventService, type TodayEventInput, type TodayEventStore } from "@/lib/today/events";
import type { TodayPlan, TodaySessionDTO } from "@/types/today";

describe("Today events", () => {
  it("persists a duplicate operation only once", async () => {
    const store = new MemoryEventStore(plan());
    const service = createTodayEventService(store);
    const event = input("op-start", "today_started", "warmup");

    const first = await service.recordTodayEvent("user-1", event);
    const second = await service.recordTodayEvent("user-1", event);

    expect(second).toEqual(first);
    expect(store.appliedOperations).toHaveLength(1);
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
