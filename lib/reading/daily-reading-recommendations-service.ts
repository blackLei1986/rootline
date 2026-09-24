import type { DailyReadingRecommendationRepository } from "@/lib/repositories/contracts";
import { rankDailyReadingRecommendations } from "@/lib/reading/daily-recommendations";
import { learningDateForTimeZone } from "@/lib/today/local-date";
import type { DailyReadingCandidate, DailyReadingRecommendationResult, DifficultyPreference, RecentLearningWord } from "@/types/reading-recommendations";
import type { DailyTargetSnapshot } from "@/types/today";

export interface DailyReadingRecommendationsServiceDependencies {
  getTimeZone(userId: string): Promise<string | null>;
  getTodayPlan(userId: string, learningDate: string, now: Date): Promise<{ dailyTargets?: Array<Pick<DailyTargetSnapshot, "wordId" | "lemma">> }>;
  getLearnerVocabularyState(userId: string): Promise<{ recentWords: RecentLearningWord[]; knownWordIds: string[] }>;
  getDifficultyPreference(userId: string): Promise<DifficultyPreference | "comfortable">;
  getCandidates(): Promise<DailyReadingCandidate[]>;
  snapshots: DailyReadingRecommendationRepository;
}

export interface DailyReadingRecommendationsResponse extends DailyReadingRecommendationResult {
  learningDate: string;
}

export function createDailyReadingRecommendationsService(dependencies: DailyReadingRecommendationsServiceDependencies) {
  return {
    async getForToday(userId: string, now: Date = new Date()): Promise<DailyReadingRecommendationsResponse> {
      const configuredTimeZone = await dependencies.getTimeZone(userId);
      let learningDate: string;
      try {
        learningDate = learningDateForTimeZone(now, configuredTimeZone ?? "Asia/Shanghai");
      } catch {
        learningDate = learningDateForTimeZone(now, "Asia/Shanghai");
      }

      const stored = await dependencies.snapshots.getSet(userId, learningDate);
      if (stored) return { learningDate, ...stored };

      const [plan, learnerState, difficultyPreference, candidates] = await Promise.all([
        dependencies.getTodayPlan(userId, learningDate, now),
        dependencies.getLearnerVocabularyState(userId),
        dependencies.getDifficultyPreference(userId),
        dependencies.getCandidates()
      ]);
      const result = rankDailyReadingRecommendations({
        candidates,
        todayTargets: (plan.dailyTargets ?? []).map(({ wordId, lemma }) => ({ wordId, lemma })),
        recentWords: learnerState.recentWords,
        knownWordIds: learnerState.knownWordIds,
        difficultyPreference: difficultyPreference === "comfortable" ? "easy" : difficultyPreference,
        now
      });

      if (result.recommendations.length === 0) return { learningDate, ...result };
      const firstSet = await dependencies.snapshots.saveFirstSet(userId, learningDate, result);
      return { learningDate, ...firstSet };
    }
  };
}
