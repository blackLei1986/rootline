import type { TodayPlan, TodaySessionDTO, TodayStage } from "@/types/today";

export type TodayEventType =
  | "today_started"
  | "stage_completed"
  | "article_opened"
  | "article_completed"
  | "context_answered"
  | "today_completed";

export interface TodayEventInput {
  operationId: string;
  planId: string;
  type: TodayEventType;
  stage: TodayStage;
  occurredAt: string;
  questionId?: string;
  correct?: boolean;
}

export interface TodayEventStore {
  getOwnedPlan(userId: string, planId: string): Promise<TodayPlan | null>;
  getSession(userId: string, planId: string): Promise<TodaySessionDTO | null>;
  getOperationResult(userId: string, operationId: string): Promise<TodaySessionDTO | null>;
  applyEvent(userId: string, event: TodayEventInput, next: TodaySessionDTO): Promise<TodaySessionDTO>;
}

export function createTodayEventService(store: TodayEventStore) {
  return {
    async getTodaySession(userId: string, planId: string): Promise<TodaySessionDTO> {
      const plan = await requireOwnedPlan(store, userId, planId);
      return await store.getSession(userId, planId) ?? initialSession(plan);
    },

    async recordTodayEvent(userId: string, event: TodayEventInput): Promise<TodaySessionDTO> {
      validateEventShape(event);
      const duplicate = await store.getOperationResult(userId, event.operationId);
      if (duplicate) return duplicate;
      const plan = await requireOwnedPlan(store, userId, event.planId);
      const current = await store.getSession(userId, event.planId) ?? initialSession(plan);
      const next = transition(plan, current, event);
      return store.applyEvent(userId, event, next);
    }
  };
}

function transition(plan: TodayPlan, current: TodaySessionDTO, event: TodayEventInput): TodaySessionDTO {
  if (current.status === "complete") {
    if (event.type === "today_completed") return current;
    throw new Error("Today session is already complete.");
  }

  if (event.type === "today_started") {
    if (current.status !== "not-started" || event.stage !== plan.stages[0]) {
      throw new Error("Today start event is not valid for the current stage.");
    }
    return { ...current, status: "active", currentStage: event.stage };
  }

  if (current.status !== "active" || current.currentStage !== event.stage) {
    throw new Error("Today event is not valid for the current stage.");
  }

  if (event.type === "article_opened" || event.type === "article_completed") {
    if (event.stage !== "reading" || !plan.article) throw new Error("Article event is not valid for this plan.");
    return current;
  }

  if (event.type === "context_answered") {
    if (event.stage !== "context-quiz" || !event.questionId) throw new Error("Context answer is incomplete.");
    if (!plan.contextQuestions.some((question) => question.id === event.questionId)) {
      throw new Error("Context question does not belong to this plan.");
    }
    const completedQuestionIds = current.completedQuestionIds.includes(event.questionId)
      ? current.completedQuestionIds
      : [...current.completedQuestionIds, event.questionId];
    const complete = completedQuestionIds.length === plan.contextQuestions.length;
    return {
      ...current,
      status: complete ? "complete" : "active",
      currentStage: complete ? "summary" : current.currentStage,
      completedQuestionIds
    };
  }

  if (event.type === "stage_completed") {
    const currentIndex = plan.stages.indexOf(event.stage);
    if (currentIndex < 0) throw new Error("Stage does not belong to this plan.");
    const nextStage = plan.stages[currentIndex + 1] ?? "summary";
    return {
      ...current,
      status: nextStage === "summary" ? "complete" : "active",
      currentStage: nextStage
    };
  }

  if (event.type === "today_completed") {
    if (event.stage !== "summary") throw new Error("Today can only complete from summary.");
    return { ...current, status: "complete", currentStage: "summary" };
  }

  throw new Error("Unsupported Today event.");
}

async function requireOwnedPlan(store: TodayEventStore, userId: string, planId: string): Promise<TodayPlan> {
  const plan = await store.getOwnedPlan(userId, planId);
  if (!plan) throw new Error("Today plan was not found for this user.");
  return plan;
}

function initialSession(plan: TodayPlan): TodaySessionDTO {
  return {
    planId: plan.id,
    status: "not-started",
    currentStage: plan.stages[0] ?? "summary",
    completedQuestionIds: []
  };
}

function validateEventShape(event: TodayEventInput): void {
  if (!event.operationId || !event.planId || !event.type || !event.stage) throw new Error("Today event is incomplete.");
  if (Number.isNaN(Date.parse(event.occurredAt))) throw new Error("Today event timestamp is invalid.");
}
