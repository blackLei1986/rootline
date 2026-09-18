import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalizeArticleUrl } from "@/lib/articles/canonicalize";
import { throwRepositoryError, toJson } from "@/lib/repositories/supabase/shared";
import type { FeedRefreshRepository, FeedRefreshSource } from "@/lib/jobs/feed-refresh";
import type { ArticleAnalysis, ArticleCandidate, ArticleRecord, ExtractedArticle } from "@/types/articles";
import type { Database } from "@/types/database";
import type { FeedSourceDTO, NormalizedFeed, NormalizedFeedEntry } from "@/types/feeds";
import type { TodayArticleBundle } from "@/lib/today/service";
import type { RecentArticleHistory } from "@/lib/today/article-selection";
import type { ReadingAvailability } from "@/lib/today/degradation";

type DatabaseClient = SupabaseClient<Database>;

export class SupabaseFeedRepository implements FeedRefreshRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getSource(sourceId: string): Promise<FeedRefreshSource | null> {
    const { data, error } = await this.client
      .from("feed_sources")
      .select("id,normalized_feed_url,etag,last_modified")
      .eq("id", sourceId)
      .maybeSingle();
    throwRepositoryError(error, "load feed source");
    return data ? {
      id: data.id,
      feedUrl: data.normalized_feed_url,
      etag: data.etag,
      lastModified: data.last_modified
    } : null;
  }

  async saveEntries(
    sourceId: string,
    entries: NormalizedFeedEntry[]
  ): Promise<{ inserted: number; duplicate: number }> {
    let inserted = 0;
    let duplicate = 0;
    const seen = new Set<string>();

    for (const entry of entries) {
      const canonicalUrl = canonicalizeArticleUrl(entry.url);
      const key = `${entry.externalId}:${canonicalUrl}`;
      if (seen.has(key)) {
        duplicate += 1;
        continue;
      }
      seen.add(key);
      const { error } = await this.client.from("articles").insert({
        feed_source_id: sourceId,
        external_id: entry.externalId,
        canonical_url: canonicalUrl,
        publisher_url: canonicalUrl,
        title: entry.title,
        author: entry.author,
        published_at: entry.publishedAt,
        summary: entry.summary,
        language: "en",
        extraction_status: "pending"
      });
      if (error?.code === "23505") duplicate += 1;
      else {
        throwRepositoryError(error, "save feed article");
        inserted += 1;
      }
    }
    return { inserted, duplicate };
  }

  async finishRefresh(
    sourceId: string,
    input: {
      status: "updated" | "not-modified" | "failed";
      etag: string | null;
      lastModified: string | null;
      errorCode?: string;
    }
  ): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("feed_sources")
      .update({
        fetch_status: input.status === "failed" ? "failed" : "ready",
        etag: input.etag,
        last_modified: input.lastModified,
        last_error_code: input.errorCode ?? null,
        ...(input.status === "failed"
          ? { next_retry_at: new Date(Date.now() + 15 * 60_000).toISOString() }
          : { last_successful_fetch_at: now, next_retry_at: null })
      })
      .eq("id", sourceId);
    throwRepositoryError(error, "finish feed refresh");
  }

  async upsertSource(feedUrl: string, feed?: NormalizedFeed): Promise<string> {
    const normalized = canonicalizeArticleUrl(feedUrl);
    const { data, error } = await this.client
      .from("feed_sources")
      .upsert(
        {
          normalized_feed_url: normalized,
          title: feed?.title ?? new URL(normalized).hostname,
          site_url: feed?.siteUrl ?? null,
          description: feed?.description ?? null
        },
        { onConflict: "normalized_feed_url" }
      )
      .select("id")
      .single();
    throwRepositoryError(error, "save feed source");
    if (!data) throw new Error("Feed source was not saved.");
    return data.id;
  }

  async subscribe(userId: string, sourceId: string): Promise<void> {
    const { error } = await this.client.from("user_feed_subscriptions").upsert(
      { user_id: userId, feed_source_id: sourceId, enabled: true },
      { onConflict: "user_id,feed_source_id" }
    );
    throwRepositoryError(error, "subscribe to feed");
  }

  async unsubscribe(userId: string, sourceId: string): Promise<void> {
    const { error } = await this.client
      .from("user_feed_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("feed_source_id", sourceId);
    throwRepositoryError(error, "unsubscribe from feed");
  }

  async listSourcesForUser(userId: string): Promise<FeedSourceDTO[]> {
    const { data: subscriptions, error: subscriptionError } = await this.client
      .from("user_feed_subscriptions")
      .select("feed_source_id,enabled")
      .eq("user_id", userId);
    throwRepositoryError(subscriptionError, "load feed subscriptions");
    if (!subscriptions?.length) return [];
    const enabledById = new Map(subscriptions.map((item) => [item.feed_source_id, item.enabled]));
    const { data: sources, error } = await this.client
      .from("feed_sources")
      .select("id,title,normalized_feed_url,site_url,fetch_status,last_successful_fetch_at")
      .in("id", [...enabledById.keys()]);
    throwRepositoryError(error, "load feed sources");
    return (sources ?? []).map((source) => ({
      id: source.id,
      title: source.title,
      feedUrl: source.normalized_feed_url,
      siteUrl: source.site_url,
      enabled: enabledById.get(source.id) ?? false,
      fetchState: source.fetch_status,
      lastFetchedAt: source.last_successful_fetch_at
    }));
  }

  async listRefreshableSourceIds(limit: number): Promise<string[]> {
    const { data, error } = await this.client
      .from("feed_sources")
      .select("id")
      .neq("fetch_status", "fetching")
      .order("last_successful_fetch_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    throwRepositoryError(error, "load refreshable feeds");
    return (data ?? []).map((row) => row.id);
  }

  async listPendingArticles(limit: number): Promise<Array<Pick<ArticleRecord, "id" | "publisherUrl" | "title">>> {
    const { data, error } = await this.client
      .from("articles")
      .select("id,publisher_url,title")
      .eq("extraction_status", "pending")
      .limit(limit);
    throwRepositoryError(error, "load pending articles");
    return (data ?? []).map((row) => ({
      id: row.id,
      publisherUrl: row.publisher_url,
      title: row.title
    }));
  }

  async saveArticleAnalysis(
    articleId: string,
    article: ExtractedArticle,
    fingerprint: string,
    analysis: ArticleAnalysis
  ): Promise<void> {
    const { error: articleError } = await this.client
      .from("articles")
      .update({
        canonical_url: article.canonicalUrl,
        title: article.title,
        author: article.byline,
        summary: article.excerpt,
        language: article.language,
        extracted_text: article.text,
        content_fingerprint: fingerprint,
        extraction_status: "extracted",
        extraction_error_code: null,
        analysis_version: analysis.vocabularyVersion
      })
      .eq("id", articleId);
    throwRepositoryError(articleError, "save extracted article");

    const { error } = await this.client.from("article_analyses").upsert(
      {
        article_id: articleId,
        vocabulary_version: analysis.vocabularyVersion,
        analysis_state: analysis.analysisState,
        word_count: analysis.wordCount,
        unique_lemma_count: analysis.uniqueLemmaCount,
        estimated_minutes: analysis.estimatedMinutes,
        lexical_matches: toJson(analysis.lexicalMatches),
        topic_features: toJson({}),
        analyzed_at: analysis.analyzedAt
      },
      { onConflict: "article_id" }
    );
    throwRepositoryError(error, "save article analysis");
  }

  async rejectArticle(articleId: string, errorCode: string): Promise<void> {
    const { error } = await this.client
      .from("articles")
      .update({ extraction_status: "rejected", extraction_error_code: errorCode })
      .eq("id", articleId);
    throwRepositoryError(error, "reject article");
  }

  async saveImportedArticle(userId: string, article: ExtractedArticle, fingerprint: string): Promise<string> {
    const { data, error } = await this.client
      .from("articles")
      .upsert(
        {
          canonical_url: article.canonicalUrl,
          publisher_url: article.publisherUrl,
          title: article.title,
          author: article.byline,
          summary: article.excerpt,
          language: article.language,
          extracted_text: article.text,
          content_fingerprint: fingerprint,
          extraction_status: "extracted"
        },
        { onConflict: "canonical_url" }
      )
      .select("id")
      .single();
    throwRepositoryError(error, "import article");
    if (!data) throw new Error("Article was not imported.");
    const { error: stateError } = await this.client.from("user_article_states").upsert(
      { user_id: userId, article_id: data.id, saved: true, last_interaction_at: new Date().toISOString() },
      { onConflict: "user_id,article_id" }
    );
    throwRepositoryError(stateError, "save imported article state");
    return data.id;
  }

  async listCandidatesForUser(userId: string): Promise<ArticleCandidate[]> {
    const { data: scores, error: scoreError } = await this.client
      .from("user_article_scores")
      .select("article_id,content_word_coverage,valuable_unknown_word_ids,score,explanation_codes,score_version")
      .eq("user_id", userId)
      .order("score", { ascending: false })
      .limit(20);
    throwRepositoryError(scoreError, "load article recommendations");
    if (!scores?.length) return [];

    const latestScores = new Map<string, (typeof scores)[number]>();
    for (const score of scores) {
      const current = latestScores.get(score.article_id);
      if (!current || score.score_version > current.score_version) latestScores.set(score.article_id, score);
    }
    const articleIds = [...latestScores.keys()];
    const [{ data: articles, error: articleError }, { data: states, error: stateError }] = await Promise.all([
      this.client
        .from("articles")
        .select("id,feed_source_id,title,canonical_url")
        .in("id", articleIds)
        .eq("extraction_status", "extracted"),
      this.client
        .from("user_article_states")
        .select("article_id,hidden,completed_at")
        .eq("user_id", userId)
        .in("article_id", articleIds)
    ]);
    throwRepositoryError(articleError, "load recommended articles");
    throwRepositoryError(stateError, "load article states");
    const excluded = new Set((states ?? []).filter((state) => state.hidden || state.completed_at).map((state) => state.article_id));
    const sourceIds = [...new Set((articles ?? []).flatMap((article) => article.feed_source_id ? [article.feed_source_id] : []))];
    const { data: sources, error: sourceError } = sourceIds.length
      ? await this.client.from("feed_sources").select("id,title").in("id", sourceIds)
      : { data: [], error: null };
    throwRepositoryError(sourceError, "load recommendation sources");
    const sourceTitles = new Map((sources ?? []).map((source) => [source.id, source.title]));

    return (articles ?? [])
      .filter((article) => !excluded.has(article.id))
      .flatMap((article) => {
        const score = latestScores.get(article.id);
        if (!score) return [];
        return [{
          articleId: article.id,
          title: article.title,
          sourceTitle: article.feed_source_id ? sourceTitles.get(article.feed_source_id) ?? "Imported article" : "Imported article",
          canonicalUrl: article.canonical_url,
          estimatedMinutes: 6,
          contentWordCoverage: score.content_word_coverage,
          valuableUnknownWordIds: score.valuable_unknown_word_ids,
          score: score.score,
          explanationCodes: score.explanation_codes
        }];
      })
      .sort((left, right) => right.score - left.score || left.articleId.localeCompare(right.articleId))
      .slice(0, 3);
  }

  async getAuthorizedArticle(userId: string, articleId: string): Promise<{
    id: string;
    title: string;
    text: string;
    publisherUrl: string;
    author: string | null;
    sourceTitle: string;
  } | null> {
    const { data: article, error } = await this.client
      .from("articles")
      .select("id,feed_source_id,title,extracted_text,publisher_url,author")
      .eq("id", articleId)
      .eq("extraction_status", "extracted")
      .maybeSingle();
    throwRepositoryError(error, "load article");
    if (!article?.extracted_text) return null;

    const [{ data: score }, { data: state }, { data: subscription }] = await Promise.all([
      this.client.from("user_article_scores").select("id").eq("user_id", userId).eq("article_id", articleId).limit(1).maybeSingle(),
      this.client.from("user_article_states").select("id").eq("user_id", userId).eq("article_id", articleId).maybeSingle(),
      article.feed_source_id
        ? this.client.from("user_feed_subscriptions").select("id").eq("user_id", userId).eq("feed_source_id", article.feed_source_id).maybeSingle()
        : Promise.resolve({ data: null })
    ]);
    if (!score && !state && !subscription) return null;
    let sourceTitle = "Imported article";
    if (article.feed_source_id) {
      const { data: source } = await this.client.from("feed_sources").select("title").eq("id", article.feed_source_id).maybeSingle();
      sourceTitle = source?.title ?? sourceTitle;
    }
    return {
      id: article.id,
      title: article.title,
      text: article.extracted_text,
      publisherUrl: article.publisher_url,
      author: article.author,
      sourceTitle
    };
  }

  async updateArticleState(
    userId: string,
    articleId: string,
    state: { saved?: boolean; hidden?: boolean; completed?: boolean }
  ): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client.from("user_article_states").upsert(
      {
        user_id: userId,
        article_id: articleId,
        ...(state.saved !== undefined ? { saved: state.saved } : {}),
        ...(state.hidden !== undefined ? { hidden: state.hidden } : {}),
        ...(state.completed ? { completed_at: now } : {}),
        last_interaction_at: now
      },
      { onConflict: "user_id,article_id" }
    );
    throwRepositoryError(error, "update article state");
  }

  async getTodayArticleBundle(userId: string, articleId: string): Promise<TodayArticleBundle | null> {
    const article = await this.getAuthorizedArticle(userId, articleId);
    if (!article) return null;
    const { data: analysis, error } = await this.client
      .from("article_analyses")
      .select("lexical_matches")
      .eq("article_id", articleId)
      .eq("analysis_state", "full")
      .maybeSingle();
    throwRepositoryError(error, "load article analysis for Today");
    if (!analysis) return null;
    return {
      id: article.id,
      text: article.text,
      lexicalMatches: analysis.lexical_matches as unknown as ArticleAnalysis["lexicalMatches"]
    };
  }

  async listRecentArticleHistory(userId: string): Promise<RecentArticleHistory[]> {
    const { data: states, error } = await this.client
      .from("user_article_states")
      .select("article_id,hidden,completed_at")
      .eq("user_id", userId)
      .order("last_interaction_at", { ascending: false })
      .limit(12);
    throwRepositoryError(error, "load recent article history");
    if (!states?.length) return [];

    const articleIds = states.map((state) => state.article_id);
    const { data: articles, error: articleError } = await this.client
      .from("articles")
      .select("id,feed_source_id")
      .in("id", articleIds);
    throwRepositoryError(articleError, "load recent article sources");
    const sourceIds = [...new Set((articles ?? []).flatMap((article) => article.feed_source_id ? [article.feed_source_id] : []))];
    const { data: sources, error: sourceError } = sourceIds.length
      ? await this.client.from("feed_sources").select("id,title").in("id", sourceIds)
      : { data: [], error: null };
    throwRepositoryError(sourceError, "load recent source titles");
    const sourceTitles = new Map((sources ?? []).map((source) => [source.id, source.title]));
    const sourceIdByArticle = new Map((articles ?? []).map((article) => [article.id, article.feed_source_id]));

    return states.map((state) => {
      const sourceId = sourceIdByArticle.get(state.article_id);
      return {
        articleId: state.article_id,
        sourceTitle: sourceId ? sourceTitles.get(sourceId) ?? "Imported article" : "Imported article",
        completed: Boolean(state.completed_at),
        hidden: state.hidden
      };
    });
  }

  async getTodayReadingAvailability(userId: string): Promise<ReadingAvailability> {
    const { data: subscriptions, error: subscriptionError } = await this.client
      .from("user_feed_subscriptions")
      .select("feed_source_id")
      .eq("user_id", userId)
      .eq("enabled", true);
    throwRepositoryError(subscriptionError, "count Today subscriptions");
    const sourceIds = (subscriptions ?? []).map((entry) => entry.feed_source_id);
    const { data: articles, error: articleError } = sourceIds.length
      ? await this.client
        .from("articles")
        .select("id,extraction_status,published_at")
        .in("feed_source_id", sourceIds)
      : { data: [], error: null };
    throwRepositoryError(articleError, "count Today articles");
    const freshnessCutoff = Date.now() - 14 * 86_400_000;
    const fresh = (articles ?? []).filter((article) => !article.published_at || Date.parse(article.published_at) >= freshnessCutoff);
    const extracted = fresh.filter((article) => article.extraction_status === "extracted");
    const extractedIds = extracted.map((article) => article.id);
    const { data: analyses, error: analysisError } = extractedIds.length
      ? await this.client
        .from("article_analyses")
        .select("article_id,analysis_state")
        .in("article_id", extractedIds)
        .eq("analysis_state", "full")
      : { data: [], error: null };
    throwRepositoryError(analysisError, "count Today analyses");
    const candidates = await this.listCandidatesForUser(userId);
    return {
      subscriptionCount: sourceIds.length,
      freshArticleCount: fresh.length,
      extractedArticleCount: extracted.length,
      analyzedArticleCount: analyses?.length ?? 0,
      eligibleArticleCount: candidates.length
    };
  }
}
