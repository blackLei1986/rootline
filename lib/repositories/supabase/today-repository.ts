import type { TodayRepository } from "@/lib/repositories/contracts";
import {
  operationWasApplied,
  recordOperation,
  throwRepositoryError,
  toJson,
  type DatabaseClient
} from "@/lib/repositories/supabase/shared";
import type { TodayPlan } from "@/types/today";
import type { TodaySessionDTO } from "@/types/today";
import type { TodayEventInput } from "@/lib/today/events";

export class SupabaseTodayRepository implements TodayRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getPlan(userId: string, date: string): Promise<TodayPlan | null> {
    const { data, error } = await this.client
      .from("today_plans")
      .select("plan_snapshot,status")
      .eq("user_id", userId)
      .eq("learning_date", date)
      .order("generation_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwRepositoryError(error, "load today's plan");
    return data ? { ...(data.plan_snapshot as unknown as TodayPlan), status: data.status } : null;
  }

  async savePlan(userId: string, plan: TodayPlan, operationId: string): Promise<void> {
    if (await operationWasApplied(this.client, userId, operationId)) return;

    await this.createPlan(userId, plan);
    await recordOperation(this.client, {
      userId,
      operationId,
      kind: "today-plan",
      entityId: plan.id,
      version: plan.version
    });
  }

  async createPlan(userId: string, plan: TodayPlan): Promise<TodayPlan> {
    const { data, error } = await this.client.rpc("create_today_plan", {
      p_user_id: userId,
      p_plan_id: plan.id,
      p_learning_date: plan.date,
      p_version: plan.version,
      p_status: plan.status,
      p_estimated_minutes: plan.estimatedMinutes,
      p_selected_article_id: plan.article?.articleId ?? null,
      p_degradation_reason: plan.degradationReason,
      p_plan_snapshot: toJson(plan),
      p_items: toJson(toPlanItems(plan))
    });
    throwRepositoryError(error, "save today's plan");
    if (!data) throw new Error("Today plan was not persisted.");
    return data as unknown as TodayPlan;
  }

  async hasSessionEvents(userId: string, planId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("today_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("plan_id", planId)
      .limit(1)
      .maybeSingle();
    throwRepositoryError(error, "check today's session state");
    return data !== null;
  }

  async getOwnedPlan(userId: string, planId: string): Promise<TodayPlan | null> {
    const { data, error } = await this.client
      .from("today_plans")
      .select("plan_snapshot,status")
      .eq("user_id", userId)
      .eq("id", planId)
      .maybeSingle();
    throwRepositoryError(error, "load owned Today plan");
    return data ? { ...(data.plan_snapshot as unknown as TodayPlan), status: data.status } : null;
  }

  async getSession(userId: string, planId: string): Promise<TodaySessionDTO | null> {
    const { data, error } = await this.client
      .from("today_sessions")
      .select("status,current_stage,outcomes")
      .eq("user_id", userId)
      .eq("plan_id", planId)
      .maybeSingle();
    throwRepositoryError(error, "load Today session");
    if (!data) return null;
    const outcomes = data.outcomes as { completedQuestionIds?: unknown } | null;
    return {
      planId,
      status: data.status,
      currentStage: data.current_stage,
      completedQuestionIds: Array.isArray(outcomes?.completedQuestionIds)
        ? outcomes.completedQuestionIds.filter((value): value is string => typeof value === "string")
        : []
    };
  }

  async getOperationResult(userId: string, operationId: string): Promise<TodaySessionDTO | null> {
    const { data, error } = await this.client
      .from("sync_operations")
      .select("entity_id")
      .eq("user_id", userId)
      .eq("operation_id", operationId)
      .eq("operation_kind", "today-event")
      .maybeSingle();
    throwRepositoryError(error, "check Today event operation");
    return data ? this.getSession(userId, data.entity_id) : null;
  }

  async applyEvent(userId: string, event: TodayEventInput, next: TodaySessionDTO): Promise<TodaySessionDTO> {
    const { data, error } = await this.client.rpc("record_today_event", {
      p_user_id: userId,
      p_operation_id: event.operationId,
      p_plan_id: event.planId,
      p_event: toJson(event),
      p_session: toJson(next)
    });
    throwRepositoryError(error, "record Today event");
    return data as unknown as TodaySessionDTO;
  }
}

function toPlanItems(plan: TodayPlan): Array<{ type: string; contentId: string; payload: unknown }> {
  const items: Array<{ type: string; contentId: string; payload: unknown }> = [];
  for (const wordId of plan.warmupReviewIds) items.push({ type: "review", contentId: wordId, payload: {} });
  for (const entry of plan.rapidScanEntries) items.push({ type: "rapid-scan", contentId: entry.id, payload: {} });
  for (const entry of plan.rapidScanEntries.slice(0, plan.focusedLearningTarget)) {
    items.push({ type: "focus-word", contentId: entry.id, payload: {} });
  }
  if (plan.article) items.push({ type: "reading", contentId: plan.article.articleId, payload: plan.article });
  for (const question of plan.contextQuestions) {
    items.push({ type: "context-question", contentId: question.id, payload: question });
  }
  return items;
}
