export type BetaJournal = {
  ratings: { difficulty: number; fatigue: number; rootUsefulness: number; reviewUsefulness: number };
  continueTomorrow: boolean;
  note: string;
};

export type BetaDay = {
  learningDate: string;
  planObserved: boolean;
  targetCount: number;
  startedAt?: string;
  completedAt?: string;
  activeMilliseconds: number;
  activityMilliseconds: Record<string, number>;
  sourceCounts: Record<string, number>;
  reviewOutcomes: Record<string, { correct: number; total: number }>;
  readingOpens: number;
  readingCompletions: number;
  progressOpens: number;
  recoverableErrors: number;
  conflictRecoveries: number;
  routeTimings: Record<string, number[]>;
  journal?: BetaJournal;
  lastEventRevision?: number;
};

export type BetaValidationLog = { version: 1; days: BetaDay[] };

export type BetaEvent =
  | { type: "plan-observed"; targetCount: number; sourceCounts?: Record<string, number> }
  | { type: "session-started"; at?: string }
  | { type: "session-completed"; at?: string }
  | { type: "activity-duration"; activity: string; milliseconds: number }
  | { type: "review-outcome"; source: string; correct: boolean }
  | { type: "reading-open" }
  | { type: "reading-completed" }
  | { type: "progress-open" }
  | { type: "recoverable-error" }
  | { type: "conflict-recovery" }
  | { type: "route-timing"; route: "today" | "reading" | "reading-article" | "progress"; milliseconds: number }
  | { type: "journal"; ratings: BetaJournal["ratings"]; continueTomorrow: boolean; note: string };

export type TodayBetaTransition =
  | { type: "session-started"; at?: string }
  | { type: "session-completed"; at?: string }
  | { type: "review-outcome"; source: string; correct: boolean }
  | { type: "recoverable-error" }
  | { type: "conflict-recovery" };


const PREFIX = "rootline:beta-validation:v1:";
const MAX_DURATION = 24 * 60 * 60 * 1000;
const SOURCE_KEYS = new Set(["carryover", "weak", "root-core", "support"]);
const ACTIVITY_KEYS = new Set(["block-a", "block-b", "block-c", "mini-review-a", "mini-review-b", "mini-review-c", "final-review"]);
const ROUTE_KEYS = new Set(["today", "reading", "reading-article", "progress"]);

function storageKey(userId: string, kind: "participation" | "log"): string {
  return `${PREFIX}${kind}:${encodeURIComponent(userId)}`;
}

function emptyLog(): BetaValidationLog {
  return { version: 1, days: [] };
}

function safeStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function validLog(value: unknown): value is BetaValidationLog {
  if (!value || typeof value !== "object") return false;
  const candidate = value as BetaValidationLog;
  return candidate.version === 1 && Array.isArray(candidate.days) && candidate.days.every((day) =>
    Boolean(day && /^\d{4}-\d{2}-\d{2}$/.test(day.learningDate) && typeof day.planObserved === "boolean" &&
      Number.isFinite(day.targetCount) && Number.isFinite(day.activeMilliseconds) && day.activityMilliseconds &&
      typeof day.activityMilliseconds === "object" && day.sourceCounts && typeof day.sourceCounts === "object" &&
      day.reviewOutcomes && typeof day.reviewOutcomes === "object" && day.routeTimings && typeof day.routeTimings === "object"));
}

export function getBetaParticipation(userId: string): boolean {
  try { return safeStorage()?.getItem(storageKey(userId, "participation")) === "true"; } catch { return false; }
}

export function setBetaParticipation(userId: string, enabled: boolean): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    if (enabled) storage.setItem(storageKey(userId, "participation"), "true");
    else deleteBetaLog(userId);
  } catch { /* Storage failure must not interrupt learning. */ }
}

export function readBetaLog(userId: string): BetaValidationLog {
  try {
    const raw = safeStorage()?.getItem(storageKey(userId, "log"));
    if (!raw) return emptyLog();
    const parsed: unknown = JSON.parse(raw);
    return validLog(parsed) ? parsed : emptyLog();
  } catch { return emptyLog(); }
}

function newDay(learningDate: string): BetaDay {
  return { learningDate, planObserved: false, targetCount: 0, activeMilliseconds: 0, activityMilliseconds: {}, sourceCounts: {}, reviewOutcomes: {}, readingOpens: 0, readingCompletions: 0, progressOpens: 0, recoverableErrors: 0, conflictRecoveries: 0, routeTimings: {} };
}

function finiteCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1000, Math.floor(value))) : 0;
}

function boundedDuration(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(MAX_DURATION, Math.floor(value))) : 0;
}

function sanitizeJournalNote(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[link removed]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removed]")
    .replace(/\b(?:article|word|vocab|target|root)[-_:#][a-z0-9_-]{4,}\b/gi, "[identifier removed]")
    .slice(0, 500);
}

export function recordBetaEvent(userId: string, learningDate: string, event: BetaEvent): void {
  if (!getBetaParticipation(userId) || !/^\d{4}-\d{2}-\d{2}$/.test(learningDate)) return;
  const storage = safeStorage();
  if (!storage) return;
  try {
    const log = readBetaLog(userId);
    const day = log.days.find((item) => item.learningDate === learningDate) ?? newDay(learningDate);
    if (!log.days.includes(day)) log.days.push(day);
    switch (event.type) {
      case "plan-observed":
        day.planObserved = true;
        day.targetCount = finiteCount(event.targetCount);
        for (const [key, count] of Object.entries(event.sourceCounts ?? {})) if (SOURCE_KEYS.has(key)) day.sourceCounts[key] = finiteCount(count);
        break;
      case "session-started": day.startedAt ??= event.at ?? new Date().toISOString(); break;
      case "session-completed": day.completedAt ??= event.at ?? new Date().toISOString(); break;
      case "activity-duration": {
        if (!ACTIVITY_KEYS.has(event.activity)) break;
        const duration = boundedDuration(event.milliseconds);
        day.activityMilliseconds[event.activity] = (day.activityMilliseconds[event.activity] ?? 0) + duration;
        day.activeMilliseconds += duration;
        break;
      }
      case "review-outcome": {
        if (!SOURCE_KEYS.has(event.source)) break;
        const outcome = day.reviewOutcomes[event.source] ?? { correct: 0, total: 0 };
        outcome.total++;
        if (event.correct) outcome.correct++;
        day.reviewOutcomes[event.source] = outcome;
        break;
      }
      case "reading-open": day.readingOpens++; break;
      case "reading-completed": day.readingCompletions++; break;
      case "progress-open": day.progressOpens++; break;
      case "recoverable-error": day.recoverableErrors++; break;
      case "conflict-recovery": day.conflictRecoveries++; break;
      case "route-timing": {
        if (!ROUTE_KEYS.has(event.route)) break;
        const samples = day.routeTimings[event.route] ?? [];
        if (samples.length < 100) samples.push(boundedDuration(event.milliseconds));
        day.routeTimings[event.route] = samples;
        break;
      }
      case "journal":
        day.journal = {
          ratings: Object.fromEntries(Object.entries(event.ratings).map(([key, value]) => [key, Math.max(1, Math.min(5, Math.floor(value)))])) as BetaJournal["ratings"],
          continueTomorrow: Boolean(event.continueTomorrow),
          note: sanitizeJournalNote(event.note),
        };
        break;
    }
    storage.setItem(storageKey(userId, "log"), JSON.stringify(log));
  } catch { /* Quota/private-mode errors are non-blocking. */ }
}

export function recordTodayBetaTransition(userId: string, learningDate: string, eventRevision: number, event: TodayBetaTransition): void {
  if (!Number.isInteger(eventRevision) || eventRevision < 0 || !getBetaParticipation(userId)) return;
  const prior = readBetaLog(userId).days.find((item) => item.learningDate === learningDate);
  if (prior?.lastEventRevision !== undefined && eventRevision <= prior.lastEventRevision) return;
  recordBetaEvent(userId, learningDate, event);
  const next = readBetaLog(userId);
  const day = next.days.find((item) => item.learningDate === learningDate);
  if (!day) return;
  day.lastEventRevision = eventRevision;
  try { safeStorage()?.setItem(storageKey(userId, "log"), JSON.stringify(next)); } catch { /* Optional measurement. */ }
}


export function exportBetaLog(userId: string): Blob {
  return new Blob([JSON.stringify(readBetaLog(userId), null, 2)], { type: "application/json" });
}

export function deleteBetaLog(userId: string): void {
  try {
    const storage = safeStorage();
    storage?.removeItem(storageKey(userId, "log"));
    storage?.removeItem(storageKey(userId, "participation"));
  } catch { /* Best effort; UI can surface unavailable storage. */ }
}
