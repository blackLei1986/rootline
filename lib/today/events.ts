import type { DailyTargetProgressDTO, TodayPlan, TodaySessionDTO, TodayStage } from "@/types/today";
import { selectFinalReviewTargets, selectMiniReviewTargets, type DailyReviewKind } from "@/lib/today/review-selection";

type DailyTargetActivity = "learning-card" | "association" | "cloze" | "recall";
type DailyReviewBlock = 1 | 2 | 3;

export class TodayEventConflictError extends Error {
  constructor() { super("Today session revision is stale."); }
}

export class TodayPlanNotFoundError extends Error {
  constructor() { super("Today plan was not found for this user."); }
}

export type TodayEventType =
  | "today_started"
  | "stage_completed"
  | "article_opened"
  | "article_completed"
  | "context_answered"
  | "target_recognized"
  | "target_activity_completed"
  | "review_answered"
  | "mini_review_completed"
  | "final_review_completed"
  | "today_completed";

export interface TodayEventInput {
  operationId: string;
  planId: string;
  type: TodayEventType;
  stage: TodayStage;
  occurredAt: string;
  questionId?: string;
  correct?: boolean;
  targetId?: string;
  block?: DailyReviewBlock;
  recognitionState?: "known" | "fuzzy" | "unknown";
  activity?: DailyTargetActivity;
  reviewKind?: DailyReviewKind;
  expectedRevision?: number;
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
      if (event.expectedRevision !== undefined && event.expectedRevision !== (current.eventRevision ?? 0)) {
        throw new TodayEventConflictError();
      }
      if (event.type === "final_review_completed" && current.finalReviewComplete && event.stage === "learn") {
        return store.applyEvent(userId, event, current);
      }
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

  if (plan.dailyTargets?.length) return transitionDailyTarget(plan, current, event);

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

function transitionDailyTarget(plan: TodayPlan, current: TodaySessionDTO, event: TodayEventInput): TodaySessionDTO {
  const targets = plan.dailyTargets ?? [];
  const targetProgress = current.targetProgress ?? {};
  const completedTargetIds = current.completedTargetIds ?? [];
  const completedMiniReviewBlocks = current.completedMiniReviewBlocks ?? [];
  const currentBlock = current.currentBlock ?? 1;
  const reviewAccuracy = current.reviewAccuracy ?? { correct: 0, total: 0 };
  const reviewAnswers = current.reviewAnswers ?? {};
  const byId = new Map(targets.map((target) => [target.wordId, target]));

  if (event.type === "target_recognized") {
    const target = requireDailyTarget(byId, event.targetId, event.block);
    if (current.currentStage !== "learn" || target.block !== currentBlock || !event.recognitionState) {
      throw new Error("Today target recognition is not valid for the current block.");
    }
    const existing = targetProgress[target.wordId];
    if (existing && existing.status !== "not-started") throw new Error("Today target has already started.");
    return {
      ...current,
      currentBlock,
      completedTargetIds,
      completedMiniReviewBlocks,
      finalReviewComplete: current.finalReviewComplete ?? false,
      reviewAccuracy,
      targetProgress: {
        ...targetProgress,
        [target.wordId]: {
          targetId: target.wordId,
          block: target.block,
          status: "active",
          currentActivity: event.recognitionState === "known" ? "association" : "learning-card",
          recognitionState: event.recognitionState,
          outcomes: {}
        }
      }
    };
  }

  if (event.type === "target_activity_completed") {
    const target = requireDailyTarget(byId, event.targetId, event.block);
    const progress = targetProgress[target.wordId];
    if (!progress || progress.status !== "active" || target.block !== currentBlock || progress.currentActivity !== event.activity) {
      throw new Error("Today target activity is not valid for this target.");
    }
    const nextActivity: Record<DailyTargetActivity, DailyTargetProgressDTO["currentActivity"]> = {
      "learning-card": "association",
      association: "cloze",
      cloze: "recall",
      recall: null
    };
    const completed = event.activity === "recall";
    const outcomes = event.activity === "association" || event.activity === "cloze" || event.activity === "recall"
      ? { ...progress.outcomes, [event.activity]: Boolean(event.correct) }
      : progress.outcomes;
    const nextProgress: DailyTargetProgressDTO = {
      ...progress,
      status: completed ? "complete" : "active",
      currentActivity: nextActivity[event.activity!],
      outcomes
    };
    const nextAccuracy = event.activity === "association" || event.activity === "cloze" || event.activity === "recall"
      ? { correct: reviewAccuracy.correct + (event.correct ? 1 : 0), total: reviewAccuracy.total + 1 }
      : reviewAccuracy;
    return {
      ...current,
      currentBlock,
      completedTargetIds: completed ? [...new Set([...completedTargetIds, target.wordId])] : completedTargetIds,
      completedMiniReviewBlocks,
      finalReviewComplete: current.finalReviewComplete ?? false,
      reviewAccuracy: nextAccuracy,
      targetProgress: { ...targetProgress, [target.wordId]: nextProgress }
    };
  }

  if (event.type === "mini_review_completed") {
    const block = event.block;
    if (!block || block !== currentBlock) throw new Error("Mini Review block is not valid for the current block.");
    const blockTargets = targets.filter((target) => target.block === block);
    if (!blockTargets.length || blockTargets.some((target) => !completedTargetIds.includes(target.wordId))) {
      throw new Error("Mini Review requires all targets in this block to be completed.");
    }
    if (selectMiniReviewTargets(targets, block).some((target) => !(`mini:${target.wordId}` in reviewAnswers))) {
      throw new Error("Mini Review requires its selected recall prompts to be answered.");
    }
    const nextBlocks = [...new Set([...completedMiniReviewBlocks, block])].sort((left, right) => left - right) as DailyReviewBlock[];
    const nextBlock = targets.find((target) => !completedMiniReviewBlocks.includes(target.block) && target.block > block)?.block ?? block;
    return {
      ...current,
      currentBlock: nextBlock,
      completedMiniReviewBlocks: nextBlocks,
      reviewAnswers
    };
  }

  if (event.type === "final_review_completed") {
    const allTargetsComplete = targets.every((target) => completedTargetIds.includes(target.wordId));
    const allMiniReviewsComplete = new Set(completedMiniReviewBlocks).size === new Set(targets.map((target) => target.block)).size;
    if (!allTargetsComplete || !allMiniReviewsComplete) throw new Error("Final Review requires completed targets and Mini Reviews.");
    if (selectFinalReviewTargets(targets, targetProgress).some((target) => !("final:" + target.wordId in reviewAnswers))) {
      throw new Error("Final Review requires its selected recall prompts to be answered.");
    }
    return {
      ...current,
      currentStage: "summary",
      finalReviewComplete: true,
      reviewAnswers
    };
  }

  if (event.type === "review_answered") {
    const reviewKind = event.reviewKind;
    if (!event.targetId || event.correct === undefined || !reviewKind) throw new Error("Review answer is incomplete.");
    const target = byId.get(event.targetId);
    if (!target || target.block !== event.block) throw new Error("Review target is not part of the frozen plan block.");
    const answerKey = `${reviewKind}:${target.wordId}`;
    if (answerKey in reviewAnswers) throw new Error("Review target was already answered.");
    const selectedTargets = reviewKind === "mini"
      ? (event.block ? selectMiniReviewTargets(targets, event.block) : [])
      : selectFinalReviewTargets(targets, targetProgress);
    if (!selectedTargets.some((item) => item.wordId === target.wordId)) throw new Error("Review target is not selected for this review.");
    if (reviewKind === "mini" && (!event.block || event.block !== currentBlock)) throw new Error("Mini Review target is not ready.");
    if (reviewKind === "final" && new Set(completedMiniReviewBlocks).size !== new Set(targets.map((item) => item.block)).size) {
      throw new Error("Final Review is not ready.");
    }
    return {
      ...current,
      reviewAnswers: { ...reviewAnswers, [answerKey]: event.correct },
      reviewAccuracy: { correct: reviewAccuracy.correct + (event.correct ? 1 : 0), total: reviewAccuracy.total + 1 }
    };
  }

  if (event.type === "today_completed") {
    if (event.stage !== "summary" || !current.finalReviewComplete) throw new Error("Today can only complete after Final Review.");
    return { ...current, status: "complete", currentStage: "summary" };
  }

  throw new Error("Unsupported Today event for a Daily 30 plan.");
}

function requireDailyTarget(
  targets: ReadonlyMap<string, NonNullable<TodayPlan["dailyTargets"]>[number]>,
  targetId: string | undefined,
  block: DailyReviewBlock | undefined
): NonNullable<TodayPlan["dailyTargets"]>[number] {
  const target = targetId ? targets.get(targetId) : undefined;
  if (!target || target.block !== block) throw new Error("Target is not part of this frozen plan block.");
  return target;
}

async function requireOwnedPlan(store: TodayEventStore, userId: string, planId: string): Promise<TodayPlan> {
  const plan = await store.getOwnedPlan(userId, planId);
  if (!plan) throw new TodayPlanNotFoundError();
  return plan;
}

function initialSession(plan: TodayPlan): TodaySessionDTO {
  const base: TodaySessionDTO = {
    planId: plan.id,
    status: "not-started",
    currentStage: plan.stages[0] ?? "summary",
    completedQuestionIds: []
  };
  if (!plan.dailyTargets?.length) return base;
  return {
    ...base,
    currentBlock: 1,
    completedTargetIds: [],
    targetProgress: {},
    completedMiniReviewBlocks: [],
    finalReviewComplete: false,
    reviewAccuracy: { correct: 0, total: 0 },
    reviewAnswers: {},
    eventRevision: 0
  };
}

function validateEventShape(event: TodayEventInput): void {
  if (!event.operationId || !event.planId || !event.type || !event.stage) throw new Error("Today event is incomplete.");
  if (Number.isNaN(Date.parse(event.occurredAt))) throw new Error("Today event timestamp is invalid.");
}
