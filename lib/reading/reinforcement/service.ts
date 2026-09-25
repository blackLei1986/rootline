import { buildSummaryTokens, type DailyReadingHighlightMatch } from "@/lib/reading/daily-reading-highlights";
import type { WeakReadingEvent } from "@/lib/repositories/supabase/reading-reinforcement-repository";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";
import type { WordProgress } from "@/types/progress";
import type { DailyReadingArticleWord } from "@/components/reading/daily-reading-article";
import { buildReinforcementQuestions } from "@/lib/reading/reinforcement/questions";
import type { PublicQuestion, PublicSession, ReadingSessionRow } from "@/lib/reading/reinforcement/types";

export type ReadingEvidenceAction = "exposure" | "detail-open";

export interface CurrentReadingArticle {
  article: DailyReadingRecommendation;
  learningDate: string;
}

export interface ReadingReinforcementDependencies {
  getCurrentArticle(userId: string, articleId: string): Promise<CurrentReadingArticle | null>;
  getVocabulary(): Promise<ProductionVocabularyEntry[]>;
  getArticleState?(userId: string, articleId: string): Promise<{openedAt: string | null; completedAt: string | null} | null>;
  getWordStates?(userId: string, wordIds: string[]): Promise<Record<string, WordProgress>>;
  getOpenedWordIds?(userId: string, articleId: string): Promise<string[]>;
  repository: {
    appendWeakEvidence(userId: string, event: WeakReadingEvent): Promise<boolean>;
    getByArticle?(userId: string, articleId: string): Promise<ReadingSessionRow | null>;
    getById?(userId: string, sessionId: string): Promise<ReadingSessionRow | null>;
    createOnce?(userId: string, articleId: string, learningDate: string, questions: ReadingSessionRow["questions"]): Promise<ReadingSessionRow>;
  };
  now?: () => Date;
}

export function createReadingReinforcementService(dependencies: ReadingReinforcementDependencies) {
  return {
    async startOrResume(userId: string, articleId: string): Promise<
      {kind: "session"; session: PublicSession} | {kind: "empty"; availableCount: 0} | {kind: "not-found"} | {kind: "unfinished"}
    > {
      const existing = await dependencies.repository.getByArticle?.(userId, articleId);
      if (existing) return {kind: "session", session: toPublicSession(existing)};
      const current = await dependencies.getCurrentArticle(userId, articleId);
      if (!current) return {kind: "not-found"};
      const articleState = await dependencies.getArticleState?.(userId, articleId);
      if (!articleState?.completedAt) return {kind: "unfinished"};
      const vocabulary = await dependencies.getVocabulary();
      const ids = [...new Set([...current.article.matchedTodayWordIds,
        ...(current.article.matchedRecent7DayWordIds ?? current.article.matchedRecentWordIds)])];
      const byId = new Map(vocabulary.map((entry) => [entry.id, entry]));
      const words: DailyReadingArticleWord[] = ids.flatMap((id) => {
        const entry = byId.get(id);
        if (!entry) return [];
        return [{wordId: id, word: entry.word, lemma: entry.lemma, surfaceForms: entry.surfaceForms,
          level: current.article.matchedTodayWordIds.includes(id) ? "today" as const : "recent-7-day" as const,
          coreMeaningZh: entry.coreMeaningZh, coreDefinitionEn: entry.coreDefinitionEn,
          morphology: null}];
      });
      const summary = current.article.summary ?? "";
      const summaryTokens = buildSummaryTokens(summary, words, vocabulary);
      const [progressByWordId, openedWordIds] = await Promise.all([
        dependencies.getWordStates?.(userId, ids) ?? {},
        dependencies.getOpenedWordIds?.(userId, articleId) ?? []
      ]);
      const questions = buildReinforcementQuestions({
        articleId, summary, summaryTokens, words,
        todayWordIds: current.article.matchedTodayWordIds,
        recentWordIds: current.article.matchedRecent7DayWordIds ?? current.article.matchedRecentWordIds,
        openedWordIds, progressByWordId
      });
      if (questions.length === 0) return {kind: "empty", availableCount: 0};
      if (!dependencies.repository.createOnce) throw new Error("Reading session persistence is unavailable.");
      const row = await dependencies.repository.createOnce(userId, articleId, current.learningDate, questions);
      return {kind: "session", session: toPublicSession(row)};
    },

    async getOwnedSession(userId: string, sessionId: string): Promise<PublicSession | null> {
      const row = await dependencies.repository.getById?.(userId, sessionId);
      return row ? toPublicSession(row) : null;
    },

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

export function toPublicSession(row: ReadingSessionRow): PublicSession {
  const question = row.questions[row.cursor];
  const currentQuestion: PublicQuestion | null = question ? {
    id: question.id, wordId: question.wordId, type: question.type,
    context: question.context, prompt: question.prompt,
    ...(question.choices ? {choices: question.choices} : {}),
    ...(question.explanation ? {explanation: question.explanation} : {})
  } : null;
  return {
    id: row.id, articleId: row.article_id, articleLabel: "文章语境词汇",
    learningDate: row.learning_date, status: row.status, cursor: row.cursor,
    total: row.questions.length, practiced: row.outcomes.length,
    correct: row.outcomes.filter((outcome) => outcome.correct).length,
    currentQuestion, outcomes: row.outcomes
  };
}
