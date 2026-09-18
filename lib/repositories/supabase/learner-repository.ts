import { EMPTY_STORAGE, migrateStorage } from "@/lib/storage";
import type { LearnerRepository } from "@/lib/repositories/contracts";
import {
  operationWasApplied,
  recordOperation,
  throwRepositoryError,
  toJson,
  type DatabaseClient
} from "@/lib/repositories/supabase/shared";
import type { LearningEvent, LearningStorage, WordProgress } from "@/types/progress";
import type { ArticleEncounterRow } from "@/lib/reading/encounters";

export class SupabaseLearnerRepository implements LearnerRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getSnapshot(userId: string): Promise<LearningStorage> {
    const [wordsResult, eventsResult, auxiliaryResult] = await Promise.all([
      this.client
        .from("word_learning_states")
        .select("word_id,state")
        .eq("user_id", userId),
      this.client
        .from("review_events")
        .select("client_event_id,event_type,word_id,session_id,occurred_at,payload")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: true })
        .limit(500),
      this.client
        .from("learner_auxiliary_state")
        .select("root_progress,daily_stats,calibration,learning_settings,transfer_stats,storage_version")
        .eq("user_id", userId)
        .maybeSingle()
    ]);

    throwRepositoryError(wordsResult.error, "load word states");
    throwRepositoryError(eventsResult.error, "load learning events");
    throwRepositoryError(auxiliaryResult.error, "load learner settings");

    const words = Object.fromEntries(
      (wordsResult.data ?? []).map((row) => [row.word_id, row.state as unknown as WordProgress])
    );
    const events = (eventsResult.data ?? []).map((row) => ({
      id: row.client_event_id,
      type: row.event_type,
      timestamp: row.occurred_at,
      ...(row.word_id ? { wordId: row.word_id } : {}),
      ...(row.session_id ? { sessionId: row.session_id } : {}),
      ...(row.payload && Object.keys(row.payload).length > 0 ? { metadata: row.payload } : {})
    })) as unknown as LearningEvent[];
    const auxiliary = auxiliaryResult.data;

    return migrateStorage({
      ...structuredClone(EMPTY_STORAGE),
      version: auxiliary?.storage_version ?? EMPTY_STORAGE.version,
      words,
      events,
      roots: auxiliary?.root_progress ?? {},
      dailyStats: auxiliary?.daily_stats ?? {},
      calibration: auxiliary?.calibration ?? null,
      settings: auxiliary?.learning_settings ?? EMPTY_STORAGE.settings,
      transferStats: auxiliary?.transfer_stats ?? EMPTY_STORAGE.transferStats
    });
  }

  async upsertWordState(
    userId: string,
    state: WordProgress,
    operationId: string
  ): Promise<void> {
    if (await operationWasApplied(this.client, userId, operationId)) return;

    const { error } = await this.client.from("word_learning_states").upsert(
      {
        user_id: userId,
        word_id: state.wordId,
        state: toJson(state),
        version: 1,
        client_updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,word_id" }
    );
    throwRepositoryError(error, "save word state");
    await recordOperation(this.client, {
      userId,
      operationId,
      kind: "word-state",
      entityId: state.wordId
    });
  }

  async appendEvents(userId: string, events: LearningEvent[]): Promise<number> {
    if (events.length === 0) return 0;

    const rows = events.map((event) => ({
      user_id: userId,
      client_event_id: event.id,
      event_type: event.type,
      word_id: event.wordId ?? null,
      session_id: event.sessionId ?? null,
      occurred_at: event.timestamp,
      payload: toJson(event.metadata ?? {})
    }));
    const { data, error } = await this.client
      .from("review_events")
      .upsert(rows, { onConflict: "user_id,client_event_id", ignoreDuplicates: true })
      .select("client_event_id");
    throwRepositoryError(error, "append learning events");
    return data?.length ?? 0;
  }

  async saveAuxiliaryState(
    userId: string,
    storage: LearningStorage,
    operationId: string
  ): Promise<void> {
    if (await operationWasApplied(this.client, userId, operationId)) return;

    const { error } = await this.client.from("learner_auxiliary_state").upsert(
      {
        user_id: userId,
        root_progress: toJson(storage.roots),
        daily_stats: toJson(storage.dailyStats),
        calibration: toJson(storage.calibration),
        learning_settings: toJson(storage.settings),
        transfer_stats: toJson(storage.transferStats),
        storage_version: storage.version,
        client_updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );
    throwRepositoryError(error, "save learner settings");
    await recordOperation(this.client, {
      userId,
      operationId,
      kind: "learner-auxiliary",
      entityId: userId,
      version: storage.version
    });
  }

  async operationWasApplied(userId: string, operationId: string): Promise<boolean> {
    return operationWasApplied(this.client, userId, operationId);
  }

  async getEncounter(userId: string, wordId: string, articleId: string): Promise<ArticleEncounterRow | null> {
    const { data, error } = await this.client
      .from("vocabulary_encounters")
      .select("word_id,document_id,source_key,occurrence_count,first_encountered_at,last_encountered_at")
      .eq("user_id", userId)
      .eq("word_id", wordId)
      .eq("document_kind", "article")
      .eq("document_id", articleId)
      .maybeSingle();
    throwRepositoryError(error, "load article encounter");
    return data ? toArticleEncounterRow(userId, data) : null;
  }

  async saveEncounter(row: ArticleEncounterRow, operationId: string): Promise<void> {
    const { error } = await this.client.rpc("record_article_encounter", {
      p_user_id: row.userId,
      p_operation_id: operationId,
      p_word_id: row.wordId,
      p_article_id: row.articleId,
      p_source_key: row.sourceKey,
      p_occurrence_count: row.occurrenceCount,
      p_first_encountered_at: row.firstEncounteredAt,
      p_last_encountered_at: row.lastEncounteredAt
    });
    throwRepositoryError(error, "save article encounter");
  }

  async listEncounters(userId: string, wordId: string): Promise<ArticleEncounterRow[]> {
    const { data, error } = await this.client
      .from("vocabulary_encounters")
      .select("word_id,document_id,source_key,occurrence_count,first_encountered_at,last_encountered_at")
      .eq("user_id", userId)
      .eq("word_id", wordId)
      .eq("document_kind", "article");
    throwRepositoryError(error, "list article encounters");
    return (data ?? []).map((row) => toArticleEncounterRow(userId, row));
  }
}

function toArticleEncounterRow(userId: string, row: {
  word_id: string;
  document_id: string;
  source_key: string | null;
  occurrence_count: number;
  first_encountered_at: string;
  last_encountered_at: string;
}): ArticleEncounterRow {
  return {
    userId,
    wordId: row.word_id,
    articleId: row.document_id,
    sourceKey: row.source_key ?? "unknown-source",
    occurrenceCount: row.occurrence_count,
    firstEncounteredAt: row.first_encountered_at,
    lastEncounteredAt: row.last_encountered_at
  };
}
