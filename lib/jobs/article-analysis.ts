import { extractArticle } from "@/lib/articles/extract";
import { fingerprintArticle } from "@/lib/articles/fingerprint";
import { safeFetchText } from "@/lib/feeds/safe-fetch";
import { EMPTY_STORAGE } from "@/lib/storage";
import { analyzeArticleForLearner } from "@/lib/reading/analyze-production";
import type { AnalysisRunResult, ArticleAnalysis, ExtractedArticle } from "@/types/articles";

export interface ArticleAnalysisRepository {
  listPendingArticles(limit: number): Promise<Array<{ id: string; publisherUrl: string; title: string }>>;
  saveArticleAnalysis(
    articleId: string,
    article: ExtractedArticle,
    fingerprint: string,
    analysis: ArticleAnalysis
  ): Promise<void>;
  rejectArticle(articleId: string, errorCode: string): Promise<void>;
}

export async function analyzePendingArticles(
  limit: number,
  repository?: ArticleAnalysisRepository
): Promise<AnalysisRunResult> {
  const resolvedRepository = repository ?? await createDefaultRepository();
  const pending = await resolvedRepository.listPendingArticles(Math.min(40, Math.max(1, limit)));
  const result: AnalysisRunResult = {
    considered: pending.length,
    extracted: 0,
    analyzed: 0,
    rejected: 0
  };

  for (const pendingArticle of pending) {
    try {
      const response = await safeFetchText(pendingArticle.publisherUrl, "article");
      const article = extractArticle(response.text, response.finalUrl);
      result.extracted += 1;
      const analysis = await analyzeArticleForLearner(
        {
          id: pendingArticle.id,
          title: article.title,
          text: article.text,
          wordCount: article.wordCount
        },
        structuredClone(EMPTY_STORAGE)
      );
      await resolvedRepository.saveArticleAnalysis(
        pendingArticle.id,
        article,
        fingerprintArticle(article),
        analysis
      );
      result.analyzed += 1;
    } catch (error) {
      await resolvedRepository.rejectArticle(pendingArticle.id, errorCode(error));
      result.rejected += 1;
    }
  }
  return result;
}

async function createDefaultRepository(): Promise<ArticleAnalysisRepository> {
  const [{ createAdminSupabaseClient }, { SupabaseFeedRepository }] = await Promise.all([
    import("@/lib/supabase/admin"),
    import("@/lib/repositories/supabase/feed-repository")
  ]);
  return new SupabaseFeedRepository(createAdminSupabaseClient());
}

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : "ANALYSIS_FAILED";
}
