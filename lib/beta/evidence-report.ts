import { parseBetaEvidenceEvent, type BetaEvidenceEvent } from "@/lib/beta/evidence-schema";

export type PersistedBetaEvent = {
  event_key: string;
  learning_date: string;
  event_type: string;
  payload: unknown;
  deployment_commit: string;
  recorded_at: string;
};

export type ServerBetaDay = {
  learningDate: string;
  planObserved: boolean;
  plansCreated: number;
  targetCount: number;
  newWordCount: number;
  sourceCounts: Record<string, number>;
  startedAt?: string;
  completedAt?: string;
  todayCompletedFromEvents: boolean;
  todayCompletionVerified: boolean;
  authoritativeCompletedAt?: string;
  totalTodayMilliseconds: number;
  activeMilliseconds: number;
  activityMilliseconds: Record<string, number>;
  reviewOutcomes: Record<string, { correct: number; total: number }>;
  todayOpens: number;
  readingOpens: number;
  readingCompletions: number;
  progressOpens: number;
  recoverableErrors: number;
  conflictRecoveries: number;
  routeTimings: Record<string, number[]>;
  journal?: Extract<BetaEvidenceEvent, { type: "journal" }>;
  deploymentCommits: string[];
  eventCount: number;
  invalidEventCount: number;
};

function newDay(learningDate: string): ServerBetaDay {
  return {
    learningDate, planObserved: false, plansCreated: 0, targetCount: 0, newWordCount: 0,
    sourceCounts: {}, todayCompletedFromEvents: false, todayCompletionVerified: false, totalTodayMilliseconds: 0,
    activeMilliseconds: 0, activityMilliseconds: {}, reviewOutcomes: {}, todayOpens: 0,
    readingOpens: 0, readingCompletions: 0, progressOpens: 0, recoverableErrors: 0,
    conflictRecoveries: 0, routeTimings: {}, deploymentCommits: [], eventCount: 0, invalidEventCount: 0,
  };
}

export function buildBetaEvidenceReport(accountId: string, rows: readonly PersistedBetaEvent[], verifiedToday: readonly {learningDate: string; completedAt: string}[] = []): { version: 2; accountId: string; days: ServerBetaDay[] } {
  const days = new Map<string, ServerBetaDay>();
  const observedReading = new Set<string>();
  const completedReading = new Set<string>();
  const sorted = [...rows].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at) || a.event_key.localeCompare(b.event_key));
  for (const row of sorted) {
    const day = days.get(row.learning_date) ?? newDay(row.learning_date);
    days.set(row.learning_date, day);
    let event: BetaEvidenceEvent;
    try {
      event = parseBetaEvidenceEvent(row.payload);
      if (event.type !== row.event_type) throw new Error("Event type mismatch");
    } catch { day.invalidEventCount++; continue; }
    day.eventCount++;
    if (!day.deploymentCommits.includes(row.deployment_commit)) day.deploymentCommits.push(row.deployment_commit);
    switch (event.type) {
      case "plan-observed":
        day.planObserved = true;
        day.targetCount = event.targetCount;
        day.newWordCount = event.newWordCount ?? 0;
        day.sourceCounts = { ...(event.sourceCounts ?? {}) };
        break;
      case "plan-created": day.plansCreated = 1; break;
      case "session-started": {
        const at = event.at ?? row.recorded_at;
        if (!day.startedAt || at < day.startedAt) day.startedAt = at;
        break;
      }
      case "session-completed": {
        const at = event.at ?? row.recorded_at;
        if (!day.completedAt || at < day.completedAt) day.completedAt = at;
        day.todayCompletedFromEvents = true;
        break;
      }
      case "activity-duration":
        day.activityMilliseconds[event.activity] = (day.activityMilliseconds[event.activity] ?? 0) + event.milliseconds;
        day.activeMilliseconds += event.milliseconds;
        break;
      case "review-outcome": {
        const origin = event.originSource ?? event.source;
        const key = `${event.kind}:${event.source}:${origin}`;
        const outcome = day.reviewOutcomes[key] ?? { correct: 0, total: 0 };
        outcome.total++;
        if (event.correct) outcome.correct++;
        day.reviewOutcomes[key] = outcome;
        break;
      }
      case "today-open": day.todayOpens++; break;
      case "reading-open": day.readingOpens++; break;
      case "reading-observed": observedReading.add(event.sessionToken); break;
      case "reading-completed":
        if (observedReading.has(event.sessionToken) && !completedReading.has(event.sessionToken)) {
          completedReading.add(event.sessionToken);
          day.readingCompletions++;
        }
        break;
      case "progress-open": day.progressOpens++; break;
      case "recoverable-error": day.recoverableErrors++; break;
      case "conflict-recovery": day.conflictRecoveries++; break;
      case "route-timing":
        (day.routeTimings[event.route] ??= []).push(event.milliseconds);
        break;
      case "journal": day.journal = event; break;
    }
  }
  for (const day of days.values()) {
    const confirmed = verifiedToday.find((item) => item.learningDate === day.learningDate);
    if (confirmed) {
      day.todayCompletionVerified = true;
      day.authoritativeCompletedAt = confirmed.completedAt;
    }
    if (day.startedAt && day.completedAt) day.totalTodayMilliseconds = Math.max(0, Date.parse(day.completedAt) - Date.parse(day.startedAt));
    day.deploymentCommits.sort();
  }
  return { version: 2, accountId, days: [...days.values()].sort((a, b) => a.learningDate.localeCompare(b.learningDate)) };
}
