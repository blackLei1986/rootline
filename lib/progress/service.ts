import type { WordProgress } from "@/types/progress";
import type { ProgressDashboardDTO, ProgressPlanDay, ProgressSessionDay } from "@/lib/progress/types";
import type { TrustedRootLink } from "@/lib/progress/roots";
import { aggregateRootMastery } from "@/lib/progress/roots";
import { calculateCompletion } from "@/lib/progress/completion";
import { buildObservedGrowth } from "@/lib/progress/growth";
import { classifyProgressVocabulary } from "@/lib/progress/vocabulary";
import { learningDateForTimeZone, shiftLearningDate } from "@/lib/today/local-date";

export interface ProgressRepository {
  getProfileTimeZone(userId: string): Promise<string>;
  getFirstPlanDate(userId: string): Promise<string | null>;
  getRecentPlanDays(userId: string, fromDate: string, toDate: string): Promise<ProgressPlanDay[]>;
  getStreakPlanDays(userId: string, todayDate: string): Promise<ProgressPlanDay[]>;
  getMatchingSessions(userId: string, planIds: string[]): Promise<ProgressSessionDay[]>;
  getWordStates(userId: string): Promise<{states: Map<string, WordProgress>; observedAt: string}>;
  getPassiveWordIds(userId: string): Promise<Set<string>>;
  getTrustedRootLinks(): Promise<TrustedRootLink[]>;
  getSnapshots(userId: string, fromDate: string, toDate: string): Promise<Array<{learningDate: string; stableCount: number}>>;
  upsertSnapshot(userId: string, date: string, count: number, catalogVersion: string,
    observedAt: string): Promise<void>;
  countCompletedReadingPractice(userId: string, fromDate: string, toDate: string): Promise<number>;
}

export function createProgressService(deps: {repository: ProgressRepository;
  getCatalog: () => Promise<{ids: ReadonlySet<string>; version: string}>}) {
  return {async getDashboard(userId: string, now: Date): Promise<ProgressDashboardDTO> {
    const timeZone = await deps.repository.getProfileTimeZone(userId);
    const todayDate = learningDateForTimeZone(now, timeZone);
    const from7 = shiftLearningDate(todayDate, -6);
    const from30 = shiftLearningDate(todayDate, -29);
    const [firstPlanDate, recentPlans, streakPlans, observedStates, passiveWordIds, trustedLinks, catalog] =
      await Promise.all([
        deps.repository.getFirstPlanDate(userId),
        deps.repository.getRecentPlanDays(userId, from30, todayDate),
        deps.repository.getStreakPlanDays(userId, todayDate),
        deps.repository.getWordStates(userId),
        deps.repository.getPassiveWordIds(userId),
        deps.repository.getTrustedRootLinks(),
        deps.getCatalog()
      ]);
    const plans = [...new Map([...recentPlans, ...streakPlans].map((plan) => [plan.id, plan])).values()];
    const sessions = await deps.repository.getMatchingSessions(userId, plans.map((plan) => plan.id));
    const completion = calculateCompletion(plans, sessions, firstPlanDate, todayDate);
    const classified = classifyProgressVocabulary(catalog.ids, observedStates.states, passiveWordIds, now);
    const roots = aggregateRootMastery(trustedLinks.filter((link) => catalog.ids.has(link.wordId)),
      observedStates.states, classified.byWordId, now);

    let growth: ProgressDashboardDTO["growth"];
    try {
      await deps.repository.upsertSnapshot(userId, todayDate, classified.stable, catalog.version,
        observedStates.observedAt);
      const snapshots = await deps.repository.getSnapshots(userId, from30, todayDate);
      growth = {available: true, ...buildObservedGrowth(snapshots, todayDate)};
    } catch {
      growth = {available: false, points: [], hasTrend: false, firstObservedDate: null};
    }

    let reading: ProgressDashboardDTO["reading"] = null;
    try {
      reading = {completedPracticeSessions7d:
        await deps.repository.countCompletedReadingPractice(userId, from7, todayDate)};
    } catch { /* Optional secondary evidence must not hide reliable core metrics. */ }

    return {
      ...completion,
      vocabulary: {touched: classified.touched, learning: classified.learning,
        stable: classified.stable, stablePercent: classified.stablePercent},
      roots, growth, reading
    };
  }};
}
