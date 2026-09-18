import type { DailyStats, LearningStorage } from "@/types/progress";

export interface LearnerModel {
  recognitionAccuracy: number;
  selfRatingCalibration: number;
  responseSpeed: number;
  retention: number;
  preferredSessionLength: 10 | 20 | 30;
  dailyCapacity: number;
  recognitionEvidence: number;
  reviewEvidence: number;
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function recentStats(dailyStats: Record<string, DailyStats>, days = 14): DailyStats[] {
  return Object.values(dailyStats)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, days);
}

export function buildLearnerModel(storage: LearningStorage): LearnerModel {
  const progress = Object.values(storage.words);
  const verificationCorrect = progress.reduce((sum, item) => sum + item.verificationCorrectCount, 0);
  const verificationWrong = progress.reduce((sum, item) => sum + item.verificationWrongCount, 0);
  const recognitionEvidence = verificationCorrect + verificationWrong;
  const recognitionAccuracy = recognitionEvidence ? clamp(verificationCorrect / recognitionEvidence * 100) : 50;

  const knownWithVerification = progress.filter((item) => item.knownCount > 0 && item.verificationCorrectCount + item.verificationWrongCount > 0);
  const calibratedKnown = knownWithVerification.reduce((sum, item) => sum + item.verificationCorrectCount, 0);
  const knownChecks = knownWithVerification.reduce((sum, item) => sum + item.verificationCorrectCount + item.verificationWrongCount, 0);
  const selfRatingCalibration = knownChecks ? clamp(calibratedKnown / knownChecks * 100) : 50;

  const responseTimes = progress.map((item) => item.averageResponseTime).filter((value): value is number => value !== null && value > 0);
  const averageResponse = responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : 5000;
  const responseSpeed = clamp(100 - Math.max(0, averageResponse - 1200) / 68);

  const reviewCorrect = progress.reduce((sum, item) => sum + item.correctCount, 0);
  const reviewWrong = progress.reduce((sum, item) => sum + item.wrongCount, 0);
  const reviewEvidence = reviewCorrect + reviewWrong;
  const averageStrength = progress.length ? progress.reduce((sum, item) => sum + item.memoryStrength, 0) / progress.length : 0;
  const reviewAccuracy = reviewEvidence ? reviewCorrect / reviewEvidence * 100 : 50;
  const retention = clamp(reviewAccuracy * 0.6 + averageStrength * 0.4);

  const recent = recentStats(storage.dailyStats).filter((stats) => stats.studyMinutes > 0 || stats.sessionsCompleted > 0);
  const completedItems = recent.reduce((sum, stats) => sum + stats.newWordsLearned + stats.reviewsCompleted, 0);
  const dailyCapacity = recent.length
    ? Math.max(5, Math.round(completedItems / recent.length))
    : storage.settings.dailyNewWordGoal + storage.settings.dailyReviewGoal;

  return {
    recognitionAccuracy,
    selfRatingCalibration,
    responseSpeed,
    retention,
    preferredSessionLength: storage.settings.learningGoal.sessionMinutes,
    dailyCapacity,
    recognitionEvidence,
    reviewEvidence
  };
}
