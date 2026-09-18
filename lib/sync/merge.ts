import { EMPTY_STORAGE, migrateStorage } from "@/lib/storage";
import type {
  CalibrationProfile,
  DailyStats,
  LearningEvent,
  LearningStorage,
  RootProgress,
  WordProgress
} from "@/types/progress";

export function mergeLearningState(
  serverValue: LearningStorage,
  localValue: LearningStorage
): LearningStorage {
  const server = migrateStorage(serverValue);
  const local = migrateStorage(localValue);

  return migrateStorage({
    ...structuredClone(EMPTY_STORAGE),
    version: Math.max(server.version, local.version),
    words: mergeRecords(server.words, local.words, wordTimestamp),
    roots: mergeRecords(server.roots, local.roots, rootTimestamp),
    dailyStats: mergeDailyStats(server.dailyStats, local.dailyStats),
    events: mergeEvents(server.events, local.events),
    calibration: newerCalibration(server.calibration, local.calibration),
    settings: isDefaultSettings(server)
      ? structuredClone(local.settings)
      : structuredClone(server.settings),
    transferStats: {
      attempts: Math.max(server.transferStats.attempts, local.transferStats.attempts),
      correct: Math.max(server.transferStats.correct, local.transferStats.correct)
    }
  });
}

function mergeRecords<T>(
  server: Record<string, T>,
  local: Record<string, T>,
  timestamp: (value: T) => string
): Record<string, T> {
  const result = structuredClone(server);
  for (const [id, localValue] of Object.entries(local)) {
    const serverValue = result[id];
    if (!serverValue || timestamp(localValue) > timestamp(serverValue)) {
      result[id] = structuredClone(localValue);
    }
  }
  return result;
}

function wordTimestamp(value: WordProgress): string {
  return maxTimestamp(
    value.lastReviewedAt,
    value.lastRecognizedAt,
    value.encounters.lastEncounterAt,
    value.firstLearnedAt
  );
}

function rootTimestamp(value: RootProgress): string {
  return maxTimestamp(value.lastReviewedAt, value.nextReviewAt);
}

function maxTimestamp(...values: Array<string | null>): string {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? "";
}

function mergeDailyStats(
  server: Record<string, DailyStats>,
  local: Record<string, DailyStats>
): Record<string, DailyStats> {
  const result = structuredClone(server);
  for (const [date, localStats] of Object.entries(local)) {
    const serverStats = result[date];
    if (!serverStats) {
      result[date] = structuredClone(localStats);
      continue;
    }
    result[date] = {
      date,
      newWordsLearned: Math.max(serverStats.newWordsLearned, localStats.newWordsLearned),
      reviewsCompleted: Math.max(serverStats.reviewsCompleted, localStats.reviewsCompleted),
      correctAnswers: Math.max(serverStats.correctAnswers, localStats.correctAnswers),
      wrongAnswers: Math.max(serverStats.wrongAnswers, localStats.wrongAnswers),
      sessionsCompleted: Math.max(serverStats.sessionsCompleted, localStats.sessionsCompleted),
      studyMinutes: Math.max(serverStats.studyMinutes, localStats.studyMinutes)
    };
  }
  return result;
}

function mergeEvents(server: LearningEvent[], local: LearningEvent[]): LearningEvent[] {
  const byId = new Map(server.map((event) => [event.id, structuredClone(event)]));
  for (const event of local) {
    if (!byId.has(event.id)) byId.set(event.id, structuredClone(event));
  }
  return [...byId.values()]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(-500);
}

function newerCalibration(
  server: CalibrationProfile | null,
  local: CalibrationProfile | null
): CalibrationProfile | null {
  if (!server) return structuredClone(local);
  if (!local) return structuredClone(server);
  return structuredClone(local.completedAt > server.completedAt ? local : server);
}

function isDefaultSettings(storage: LearningStorage): boolean {
  return JSON.stringify(storage.settings) === JSON.stringify(EMPTY_STORAGE.settings);
}
