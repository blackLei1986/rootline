import {
  throwRepositoryError,
  type DatabaseClient
} from "@/lib/repositories/supabase/shared";
import type {
  DailyReadingArticleReadState,
  DailyReadingArticleStateRepository,
  DailyReadingStatePatch
} from "@/lib/reading/daily-reading-article-service";

type StoredArticleReadState = { opened_at: string | null; completed_at: string | null };

export class SupabaseDailyReadingArticleRepository implements DailyReadingArticleStateRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getState(userId: string, articleId: string): Promise<DailyReadingArticleReadState | null> {
    const { data, error } = await this.client
      .from("user_article_states")
      .select("opened_at,completed_at")
      .eq("user_id", userId)
      .eq("article_id", articleId)
      .maybeSingle();
    throwRepositoryError(error, "load Daily-3 article state");
    return data ? mapState(data as StoredArticleReadState) : null;
  }

  async updateState(
    userId: string,
    articleId: string,
    patch: DailyReadingStatePatch
  ): Promise<DailyReadingArticleReadState> {
    if (!patch.opened && !patch.completed) throw new Error("A Daily-3 read-state update must include an action.");

    const now = new Date().toISOString();
    const insert = {
      user_id: userId,
      article_id: articleId,
      ...(patch.opened ? { opened_at: now } : {}),
      ...(patch.completed ? { completed_at: now } : {})
    };
    const { error: insertError } = await this.client.from("user_article_states").upsert(insert, {
      onConflict: "user_id,article_id",
      ignoreDuplicates: true
    });
    throwRepositoryError(insertError, "create Daily-3 article state");

    if (patch.opened) {
      const { error } = await this.client.from("user_article_states").update({ opened_at: now })
        .eq("user_id", userId).eq("article_id", articleId).is("opened_at", null);
      throwRepositoryError(error, "mark Daily-3 article opened");
    }
    if (patch.completed) {
      const { error } = await this.client.from("user_article_states").update({ completed_at: now })
        .eq("user_id", userId).eq("article_id", articleId).is("completed_at", null);
      throwRepositoryError(error, "mark Daily-3 article completed");
    }

    const state = await this.getState(userId, articleId);
    if (!state) throw new Error("Daily-3 article state was not persisted.");
    return state;
  }
}

function mapState(state: StoredArticleReadState): DailyReadingArticleReadState {
  return { openedAt: state.opened_at, completedAt: state.completed_at };
}
