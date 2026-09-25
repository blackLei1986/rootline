import { collectPagedRecords } from "@/lib/repositories/supabase/morphology-coverage-repository";
import { throwRepositoryError, type DatabaseClient } from "@/lib/repositories/supabase/shared";
import { shiftLearningDate } from "@/lib/today/local-date";
import type { ProgressRepository } from "@/lib/progress/service";
import type { ProgressPlanDay, ProgressSessionDay } from "@/lib/progress/types";
import type { TrustedRootLink } from "@/lib/progress/roots";
import type { WordProgress } from "@/types/progress";

type PlanRow = {id: string; learning_date: string; generation_version: number;
  status: ProgressPlanDay["status"]; completed_at: string | null;
  degradation_reason: string | null; plan_snapshot: unknown};
type MorphologyRow = {catalog_word_id: string; confidence: string; review_status: string;
  word_morphology_segments?: Array<{kind: string; root_id: string | null}>};

export class SupabaseProgressRepository implements ProgressRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getProfileTimeZone(userId: string): Promise<string> {
    const {data, error} = await this.client.from("profiles").select("timezone")
      .eq("user_id", userId).maybeSingle();
    throwRepositoryError(error, "load Progress timezone");
    return data?.timezone ?? "Asia/Shanghai";
  }

  async getFirstPlanDate(userId: string): Promise<string | null> {
    const {data, error} = await this.client.from("today_plans").select("learning_date")
      .eq("user_id", userId).order("learning_date", {ascending: true}).limit(1).maybeSingle();
    throwRepositoryError(error, "load first Today plan date");
    return data?.learning_date ?? null;
  }

  async getRecentPlanDays(userId: string, fromDate: string, toDate: string): Promise<ProgressPlanDay[]> {
    const rows = await collectPagedRecords(async (from, to) => {
      const {data, error} = await this.client.from("today_plans")
        .select("id,learning_date,generation_version,status,completed_at,degradation_reason,plan_snapshot")
        .eq("user_id", userId).gte("learning_date", fromDate).lte("learning_date", toDate)
        .order("learning_date", {ascending: true})
        .order("generation_version", {ascending: false}).range(from, to);
      throwRepositoryError(error, "load Progress Today plans");
      return (data ?? []) as PlanRow[];
    });
    return rows.map(mapPlan);
  }

  async getStreakPlanDays(userId: string, todayDate: string): Promise<ProgressPlanDay[]> {
    const collected: ProgressPlanDay[] = [];
    let windowEnd = todayDate;
    let firstWindow = true;
    for (;;) {
      const windowStart = shiftLearningDate(windowEnd, -29);
      const page = await this.getRecentPlanDays(userId, windowStart, windowEnd);
      collected.push(...page);
      const present = new Set(page.map((plan) => plan.learningDate));
      for (let date = windowEnd; date >= windowStart; date = shiftLearningDate(date, -1)) {
        if (!present.has(date) && !(firstWindow && date === todayDate)) return collected;
      }
      firstWindow = false;
      windowEnd = shiftLearningDate(windowStart, -1);
    }
  }

  async getMatchingSessions(userId: string, planIds: string[]): Promise<ProgressSessionDay[]> {
    if (planIds.length === 0) return [];
    const output: ProgressSessionDay[] = [];
    for (let index = 0; index < planIds.length; index += 100) {
      const ids = planIds.slice(index, index + 100);
      const {data, error} = await this.client.from("today_sessions")
        .select("plan_id,status,outcomes").eq("user_id", userId).in("plan_id", ids);
      throwRepositoryError(error, "load Progress Today sessions");
      output.push(...(data ?? []).map((row) => ({planId: row.plan_id, status: row.status,
        completedTargetIds: stringArray(record(row.outcomes).completedTargetIds)})));
    }
    return output;
  }

  async getWordStates(userId: string): Promise<Map<string, WordProgress>> {
    const rows = await collectPagedRecords(async (from, to) => {
      const {data, error} = await this.client.from("word_learning_states")
        .select("word_id,state").eq("user_id", userId).order("word_id").range(from, to);
      throwRepositoryError(error, "load Progress word states");
      return data ?? [];
    });
    return new Map(rows.map((row) => [row.word_id, row.state as unknown as WordProgress]));
  }

  async getPassiveWordIds(userId: string): Promise<Set<string>> {
    const rows = await collectPagedRecords(async (from, to) => {
      const {data, error} = await this.client.rpc("progress_passive_word_ids", {p_user_id: userId})
        .order("word_id").range(from, to);
      throwRepositoryError(error, "load Progress passive word IDs");
      return data ?? [];
    });
    return new Set(rows.map((row) => row.word_id));
  }

  async getTrustedRootLinks(): Promise<TrustedRootLink[]> {
    const {data: dataset, error: datasetError} = await this.client.from("morphology_datasets")
      .select("id").eq("kind", "gold").eq("status", "published")
      .order("published_at", {ascending: false}).limit(1).maybeSingle();
    throwRepositoryError(datasetError, "load published Gold morphology dataset");
    if (!dataset) return [];
    const roots = await collectPagedRecords(async (from, to) => {
      const {data, error} = await this.client.from("morphology_roots").select("id,root_key")
        .eq("dataset_id", dataset.id).order("id").range(from, to);
      throwRepositoryError(error, "load Progress trusted roots");
      return data ?? [];
    });
    const rootKeyById = new Map(roots.map((root) => [root.id, root.root_key]));
    const records = await collectPagedRecords(async (from, to) => {
      const {data, error} = await this.client.from("word_morphology_records")
        .select("catalog_word_id,confidence,review_status,word_morphology_segments(kind,root_id)")
        .eq("dataset_id", dataset.id).eq("review_status", "approved").eq("confidence", "verified")
        .order("catalog_word_id").range(from, to);
      throwRepositoryError(error, "load Progress verified morphology links");
      return (data ?? []) as unknown as MorphologyRow[];
    });
    const unique = new Map<string, TrustedRootLink>();
    for (const record of records) {
      if (record.review_status !== "approved" || record.confidence !== "verified") continue;
      for (const segment of record.word_morphology_segments ?? []) {
        if (segment.kind !== "root" || !segment.root_id) continue;
        const rootKey = rootKeyById.get(segment.root_id);
        if (!rootKey) continue;
        unique.set(`${segment.root_id}:${record.catalog_word_id}`, {
          rootId: segment.root_id, rootKey, wordId: record.catalog_word_id
        });
      }
    }
    return [...unique.values()];
  }

  async getSnapshots(userId: string, fromDate: string, toDate: string): Promise<Array<{learningDate: string; stableCount: number}>> {
    const {data, error} = await this.client.from("progress_vocabulary_snapshots")
      .select("learning_date,stable_count").eq("user_id", userId)
      .gte("learning_date", fromDate).lte("learning_date", toDate)
      .order("learning_date", {ascending: true});
    throwRepositoryError(error, "load Progress growth snapshots");
    return (data ?? []).map((row) => ({learningDate: row.learning_date, stableCount: row.stable_count}));
  }

  async upsertSnapshot(userId: string, date: string, count: number, catalogVersion: string,
    observedAt: string): Promise<void> {
    const {error} = await this.client.rpc("progress_record_stable_snapshot", {
      p_user_id: userId, p_learning_date: date, p_stable_count: count,
      p_catalog_version: catalogVersion, p_observed_at: observedAt
    });
    throwRepositoryError(error, "save Progress growth snapshot");
  }

  async countCompletedReadingPractice(userId: string, fromDate: string, toDate: string): Promise<number> {
    const {count, error} = await this.client.from("reading_reinforcement_sessions")
      .select("id", {count: "exact", head: true}).eq("user_id", userId).eq("status", "complete")
      .gte("learning_date", fromDate).lte("learning_date", toDate);
    throwRepositoryError(error, "count completed Reading practice");
    return count ?? 0;
  }
}

function mapPlan(row: PlanRow): ProgressPlanDay {
  const targetIds = stringArray(record(row.plan_snapshot).dailyTargets, "wordId");
  return {id: row.id, learningDate: row.learning_date, generationVersion: row.generation_version,
    status: row.status, completedAt: row.completed_at, requiredTargetIds: targetIds,
    degradationReason: row.degradation_reason};
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown, key?: string): string[] {
  return Array.isArray(value) ? value.flatMap((item) => {
    const candidate = key ? record(item)[key] : item;
    return typeof candidate === "string" ? [candidate] : [];
  }) : [];
}
