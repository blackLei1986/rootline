import { buildSummaryTokens, type DailyReadingHighlightMatch } from "@/lib/reading/daily-reading-highlights";
import type { WeakReadingEvent } from "@/lib/repositories/supabase/reading-reinforcement-repository";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

export type ReadingEvidenceAction = "exposure" | "detail-open";

export interface CurrentReadingArticle {
  article: DailyReadingRecommendation;
  learningDate: string;
}

export interface ReadingReinforcementDependencies {
  getCurrentArticle(userId: string, articleId: string): Promise<CurrentReadingArticle | null>;
  getVocabulary(): Promise<ProductionVocabularyEntry[]>;
  repository: {
    appendWeakEvidence(userId: string, event: WeakReadingEvent): Promise<boolean>;
  };
  now?: () => Date;
}

export function createReadingReinforcementService(dependencies: ReadingReinforcementDependencies) {
  return {
    async recordReadingEvidence(
      userId: string, articleId: string, action: ReadingEvidenceAction, wordId: string
    ): Promise<{saved: boolean} | null> {
      const current = await dependencies.getCurrentArticle(userId, articleId);
      if (!current || !current.article.summary?.trim()) return null;
      const article = current.article;
      const summary = article.summary;
      if (!summary) return null;
      const allowed = new Set([...article.matchedTodayWordIds,
        ...(article.matchedRecent7DayWordIds ?? article.matchedRecentWordIds)]);
      if (!allowed.has(wordId)) return null;
      const vocabulary = await dependencies.getVocabulary();
      const byId = new Map(vocabulary.map((entry) => [entry.id, entry]));
      const matches: DailyReadingHighlightMatch[] = [...allowed].flatMap((id) => {
        const entry = byId.get(id);
        return entry ? [{wordId: id, lemma: entry.lemma, surfaceForms: entry.surfaceForms,
          level: article.matchedTodayWordIds.includes(id) ? "today" as const : "recent-7-day" as const}] : [];
      });
      const tokens = buildSummaryTokens(summary, matches, vocabulary);
      if (!tokens.some((token) => token.wordId === wordId)) return null;
      const event: WeakReadingEvent = {
        id: `${action === "exposure" ? "reading-exposure" : "reading-lookup"}:${articleId}:${wordId}`,
        type: action === "exposure" ? "reading_encounter" : "reading_lookup",
        articleId, wordId, occurredAt: (dependencies.now?.() ?? new Date()).toISOString()
      };
      return {saved: await dependencies.repository.appendWeakEvidence(userId, event)};
    }
  };
}
