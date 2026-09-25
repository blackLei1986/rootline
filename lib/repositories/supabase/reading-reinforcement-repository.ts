import type { DatabaseClient } from "@/lib/repositories/supabase/shared";
import { throwRepositoryError, toJson } from "@/lib/repositories/supabase/shared";
import type { WordProgress } from "@/types/progress";
import type {
  CommitReadingAnswerInput,
  CommitReadingAnswerResult,
  FrozenQuestion,
  ReadingSessionRow
} from "@/lib/reading/reinforcement/types";

export interface WeakReadingEvent {
  id: string;
  type: "reading_encounter" | "reading_lookup";
  wordId: string;
  articleId: string;
  occurredAt: string;
}

export class SupabaseReadingReinforcementRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getByArticle(userId: string, articleId: string): Promise<ReadingSessionRow | null> {
    const { data, error } = await this.client.from("reading_reinforcement_sessions")
      .select("*").eq("user_id", userId).eq("article_id", articleId).maybeSingle();
    throwRepositoryError(error, "load reading reinforcement session");
    return data as unknown as ReadingSessionRow | null;
  }

  async getById(userId: string, sessionId: string): Promise<ReadingSessionRow | null> {
    const { data, error } = await this.client.from("reading_reinforcement_sessions")
      .select("*").eq("user_id", userId).eq("id", sessionId).maybeSingle();
    throwRepositoryError(error, "load reading reinforcement session");
    return data as unknown as ReadingSessionRow | null;
  }

  async createOnce(
    userId: string, articleId: string, learningDate: string, frozenQuestions: FrozenQuestion[]
  ): Promise<ReadingSessionRow> {
    if (frozenQuestions.length < 1 || frozenQuestions.length > 5) {
      throw new Error("A reading session needs one to five safe questions.");
    }
    const { error } = await this.client.from("reading_reinforcement_sessions").upsert({
      user_id: userId,
      article_id: articleId,
      learning_date: learningDate,
      questions: toJson(frozenQuestions)
    }, { onConflict: "user_id,article_id", ignoreDuplicates: true });
    throwRepositoryError(error, "create reading reinforcement session");
    const stored = await this.getByArticle(userId, articleId);
    if (!stored) throw new Error("Reading reinforcement session was not persisted.");
    return stored;
  }

  async listActive(userId: string, limit = 3): Promise<ReadingSessionRow[]> {
    const { data, error } = await this.client.from("reading_reinforcement_sessions")
      .select("*").eq("user_id", userId).eq("status", "active")
      .order("updated_at", { ascending: false }).limit(Math.min(3, Math.max(0, limit)));
    throwRepositoryError(error, "list reading reinforcement sessions");
    return (data ?? []) as unknown as ReadingSessionRow[];
  }

  async getWordState(userId: string, wordId: string): Promise<WordProgress | null> {
    const { data, error } = await this.client.from("word_learning_states")
      .select("state").eq("user_id", userId).eq("word_id", wordId).maybeSingle();
    throwRepositoryError(error, "load reading word state");
    return data ? data.state as unknown as WordProgress : null;
  }

  async appendWeakEvidence(userId: string, event: WeakReadingEvent): Promise<boolean> {
    const { data, error } = await this.client.from("review_events").upsert({
      user_id: userId,
      client_event_id: event.id,
      event_type: event.type,
      word_id: event.wordId,
      session_id: null,
      occurred_at: event.occurredAt,
      payload: toJson({ articleId: event.articleId, mode: "reading" })
    }, { onConflict: "user_id,client_event_id", ignoreDuplicates: true }).select("id");
    throwRepositoryError(error, "record reading evidence");
    return (data?.length ?? 0) > 0;
  }

  async commitAnswer(input: CommitReadingAnswerInput): Promise<CommitReadingAnswerResult> {
    const { data, error } = await this.client.rpc("apply_reading_answer", {
      p_user_id: input.userId,
      p_session_id: input.sessionId,
      p_question_id: input.questionId,
      p_expected_session_revision: input.expectedSessionRevision,
      p_word_id: input.wordId,
      p_expected_reading_revision: input.expectedReadingRevision,
      p_event_id: input.eventId,
      p_submitted_answer: input.submittedAnswer,
      p_correct: input.correct,
      p_event_type: input.eventType,
      p_event_payload: toJson(input.eventPayload),
      p_next_state: toJson(input.nextWordState)
    });
    throwRepositoryError(error, "commit reading answer");
    return data as unknown as CommitReadingAnswerResult;
  }
}
