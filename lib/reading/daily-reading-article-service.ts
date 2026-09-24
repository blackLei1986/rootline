import type { DailyReadingRecommendation, DailyReadingRecommendationResult } from "@/types/reading-recommendations";

export interface DailyReadingArticleReadState {
  openedAt: string | null;
  completedAt: string | null;
}

export interface DailyReadingStatePatch {
  opened?: true;
  completed?: true;
}

export interface DailyReadingArticleStateRepository {
  getState(userId: string, articleId: string): Promise<DailyReadingArticleReadState | null>;
  updateState(userId: string, articleId: string, patch: DailyReadingStatePatch): Promise<DailyReadingArticleReadState>;
}

export interface DailyReadingArticleServiceDependencies {
  recommendations: {
    getForToday(userId: string): Promise<Pick<DailyReadingRecommendationResult, "recommendations">>;
  };
  states: DailyReadingArticleStateRepository;
}

export function createDailyReadingArticleService(dependencies: DailyReadingArticleServiceDependencies) {
  async function getArticle(userId: string, articleId: string): Promise<DailyReadingRecommendation | null> {
    const snapshot = await dependencies.recommendations.getForToday(userId);
    return snapshot.recommendations.find((item) => item.articleId === articleId) ?? null;
  }

  return {
    getArticle,

    async getState(userId: string, articleId: string): Promise<DailyReadingArticleReadState | null> {
      if (!await getArticle(userId, articleId)) return null;
      return await dependencies.states.getState(userId, articleId) ?? { openedAt: null, completedAt: null };
    },

    async updateState(
      userId: string,
      articleId: string,
      patch: DailyReadingStatePatch
    ): Promise<DailyReadingArticleReadState | null> {
      if (!patch.opened && !patch.completed) throw new Error("A Daily-3 read-state update must include an action.");
      if (!await getArticle(userId, articleId)) return null;
      return dependencies.states.updateState(userId, articleId, patch);
    }
  };
}
