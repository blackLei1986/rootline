export type BetaJournal = {
  ratings: { difficulty: number; fatigue: number; rootUsefulness: number; reviewUsefulness: number };
  continueTomorrow: boolean;
  note: string;
};

export type BetaDay = {
  learningDate: string;
  planObserved: boolean;
  plansCreated: number;
  targetCount: number;
  newWordCount: number;
  startedAt?: string;
  completedAt?: string;
  activeMilliseconds: number;
  activityMilliseconds: Record<string, number>;
  sourceCounts: Record<string, number>;
  reviewOutcomes: Record<string, { correct: number; total: number }>;
  readingOpens: number;
  todayOpens: number;
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
  | { type: "plan-observed"; targetCount: number; newWordCount?: number; sourceCounts?: Record<string, number> }
  | { type: "plan-created" }
  | { type: "session-started"; at?: string }
  | { type: "session-completed"; at?: string }
  | { type: "activity-duration"; activity: string; milliseconds: number }
  | { type: "review-outcome"; kind: "mini" | "final"; source: string; originSource?: "root-core" | "support"; correct: boolean }
  | { type: "reading-open" }
  | { type: "today-open" }
  | { type: "reading-completed" }
  | { type: "progress-open" }
  | { type: "recoverable-error" }
  | { type: "conflict-recovery" }
  | { type: "route-timing"; route: "today" | "reading" | "reading-article" | "progress"; milliseconds: number }
  | { type: "journal"; ratings: BetaJournal["ratings"]; continueTomorrow: boolean; note: string };

export type TodayBetaTransition =
  | { type: "session-started"; at?: string }
  | { type: "session-completed"; at?: string }
  | { type: "review-outcome"; kind: "mini" | "final"; source: string; originSource?: "root-core" | "support"; correct: boolean }
  | { type: "recoverable-error" }
  | { type: "conflict-recovery" };


const PREFIX = "rootline:beta-validation:v1:";
const TIMER_PREFIX = "rootline:beta-validation:timer:v1:";
const PARTICIPATION_CHANGED = "rootline:beta-validation:participation-changed";
const MAX_DURATION = 24 * 60 * 60 * 1000;
const SOURCE_KEYS = new Set(["carryover", "weak", "root-core", "support"]);
const ACTIVITY_KEYS = new Set(["block-a", "block-b", "block-c", "mini-review-a", "mini-review-b", "mini-review-c", "final-review"]);
const ROUTE_KEYS = new Set(["today", "reading", "reading-article", "progress"]);

export function isBetaLearningDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function storageKey(userId: string, kind: "participation" | "log"): string {
  return `${PREFIX}${kind}:${encodeURIComponent(userId)}`;
}

function emptyLog(): BetaValidationLog {
  return { version: 1, days: [] };
}

function safeStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function normalizeLog(value: unknown): BetaValidationLog | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 || !Array.isArray(candidate.days)) return null;
  const days: BetaDay[] = [];
  for (const untrusted of candidate.days) {
    if (!untrusted || typeof untrusted !== "object") return null;
    const input = untrusted as Record<string, unknown>;
    if (!isBetaLearningDate(input.learningDate) || typeof input.planObserved !== "boolean") return null;
    const day = newDay(input.learningDate);
    day.planObserved = input.planObserved;
    day.plansCreated = finiteCount(input.plansCreated);
    day.targetCount = finiteCount(input.targetCount);
    day.newWordCount = finiteCount(input.newWordCount);
    day.activeMilliseconds = boundedDuration(input.activeMilliseconds);
    day.todayOpens = finiteCount(input.todayOpens);
    day.readingOpens = finiteCount(input.readingOpens);
    day.readingCompletions = finiteCount(input.readingCompletions);
    day.progressOpens = finiteCount(input.progressOpens);
    day.recoverableErrors = finiteCount(input.recoverableErrors);
    day.conflictRecoveries = finiteCount(input.conflictRecoveries);
    if (typeof input.startedAt === "string" && Number.isFinite(Date.parse(input.startedAt)) && new Date(input.startedAt).toISOString() === input.startedAt) day.startedAt = input.startedAt;
    if (typeof input.completedAt === "string" && Number.isFinite(Date.parse(input.completedAt)) && new Date(input.completedAt).toISOString() === input.completedAt) day.completedAt = input.completedAt;
    const activities = input.activityMilliseconds && typeof input.activityMilliseconds === "object" ? input.activityMilliseconds as Record<string, unknown> : {};
    for (const [key, duration] of Object.entries(activities)) if (ACTIVITY_KEYS.has(key)) day.activityMilliseconds[key] = boundedDuration(duration);
    const sources = input.sourceCounts && typeof input.sourceCounts === "object" ? input.sourceCounts as Record<string, unknown> : {};
    for (const [key, count] of Object.entries(sources)) if (SOURCE_KEYS.has(key)) day.sourceCounts[key] = finiteCount(count);
    const outcomes = input.reviewOutcomes && typeof input.reviewOutcomes === "object" ? input.reviewOutcomes as Record<string, unknown> : {};
    for (const [key, rawOutcome] of Object.entries(outcomes)) {
      const [kind, source, origin, extra] = key.split(":");
      if ((kind !== "mini" && kind !== "final") || !source || !SOURCE_KEYS.has(source) || !origin || !SOURCE_KEYS.has(origin) || extra || !rawOutcome || typeof rawOutcome !== "object") continue;
      const outcome = rawOutcome as Record<string, unknown>;
      const total = finiteCount(outcome.total);
      day.reviewOutcomes[key] = {total, correct: Math.min(total, finiteCount(outcome.correct))};
    }
    const timings = input.routeTimings && typeof input.routeTimings === "object" ? input.routeTimings as Record<string, unknown> : {};
    for (const [key, samples] of Object.entries(timings)) {
      if (!ROUTE_KEYS.has(key) || !Array.isArray(samples)) continue;
      day.routeTimings[key] = samples.slice(0, 100).map(boundedDuration);
    }
    if (input.journal && typeof input.journal === "object") {
      const journal = input.journal as Record<string, unknown>;
      const ratings = journal.ratings && typeof journal.ratings === "object" ? journal.ratings as Record<string, unknown> : {};
      const ratingKeys = ["difficulty", "fatigue", "rootUsefulness", "reviewUsefulness"] as const;
      if (ratingKeys.every((key) => Number.isInteger(ratings[key]) && (ratings[key] as number) >= 1 && (ratings[key] as number) <= 5) && typeof journal.continueTomorrow === "boolean") {
        day.journal = {
          ratings: Object.fromEntries(ratingKeys.map((key) => [key, ratings[key]])) as BetaJournal["ratings"],
          continueTomorrow: journal.continueTomorrow,
          note: sanitizeJournalNote(journal.note),
        };
      }
    }
    if (Number.isInteger(input.lastEventRevision) && (input.lastEventRevision as number) >= 0) day.lastEventRevision = input.lastEventRevision as number;
    days.push(day);
  }
  return {version: 1, days};
}

export function getBetaParticipation(userId: string): boolean {
  try { return safeStorage()?.getItem(storageKey(userId, "participation")) === "true"; } catch { return false; }
}

export function subscribeBetaParticipation(userId: string, listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const targetKey = storageKey(userId, "participation");
  const onStorage = (event: StorageEvent) => { if (event.key === targetKey || event.key === null) listener(); };
  const onChange = (event: Event) => {
    if (event instanceof CustomEvent && event.detail === targetKey) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(PARTICIPATION_CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PARTICIPATION_CHANGED, onChange);
  };
}

function notifyParticipationChanged(userId: string): void {
  try { window.dispatchEvent(new CustomEvent(PARTICIPATION_CHANGED, {detail: storageKey(userId, "participation")})); } catch { /* Server rendering or locked-down browser. */ }
}

export function setBetaParticipation(userId: string, enabled: boolean): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    if (enabled) {
      storage.setItem(storageKey(userId, "participation"), "true");
      notifyParticipationChanged(userId);
    }
    else deleteBetaLog(userId);
  } catch { /* Storage failure must not interrupt learning. */ }
}

export function readBetaLog(userId: string): BetaValidationLog {
  try {
    const raw = safeStorage()?.getItem(storageKey(userId, "log"));
    if (!raw) return emptyLog();
    const parsed: unknown = JSON.parse(raw);
    return normalizeLog(parsed) ?? emptyLog();
  } catch { return emptyLog(); }
}

export function hasMalformedBetaLog(userId: string): boolean {
  try {
    const raw = safeStorage()?.getItem(storageKey(userId, "log"));
    return raw !== null && raw !== undefined && normalizeLog(JSON.parse(raw)) === null;
  } catch { return true; }
}

function newDay(learningDate: string): BetaDay {
  return { learningDate, planObserved: false, plansCreated: 0, targetCount: 0, newWordCount: 0, activeMilliseconds: 0, activityMilliseconds: {}, sourceCounts: {}, reviewOutcomes: {}, todayOpens: 0, readingOpens: 0, readingCompletions: 0, progressOpens: 0, recoverableErrors: 0, conflictRecoveries: 0, routeTimings: {} };
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
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[identifier removed]")
    .replace(/\b(?:article|word|vocab|target|root)[-_:#][a-z0-9_-]{4,}\b/gi, "[identifier removed]")
    .slice(0, 500);
}

export function recordBetaEvent(userId: string, learningDate: string, event: BetaEvent): void {
  if (!getBetaParticipation(userId) || !isBetaLearningDate(learningDate)) return;
  const storage = safeStorage();
  if (!storage) return;
  try {
    if (hasMalformedBetaLog(userId)) return;
    const log = readBetaLog(userId);
    const day = log.days.find((item) => item.learningDate === learningDate) ?? newDay(learningDate);
    if (!log.days.includes(day)) log.days.push(day);
    switch (event.type) {
      case "plan-observed":
        day.planObserved = true;
        day.targetCount = finiteCount(event.targetCount);
        day.newWordCount = finiteCount(event.newWordCount);
        for (const [key, count] of Object.entries(event.sourceCounts ?? {})) if (SOURCE_KEYS.has(key)) day.sourceCounts[key] = finiteCount(count);
        break;
      case "plan-created": day.plansCreated = 1; break;
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
        const origin = event.originSource ?? (event.source === "root-core" || event.source === "support" ? event.source : event.source);
        if (!SOURCE_KEYS.has(origin)) break;
        const outcomeKey = `${event.kind}:${event.source}:${origin}`;
        const outcome = day.reviewOutcomes[outcomeKey] ?? { correct: 0, total: 0 };
        outcome.total++;
        if (event.correct) outcome.correct++;
        day.reviewOutcomes[outcomeKey] = outcome;
        break;
      }
      case "reading-open": day.readingOpens++; break;
      case "today-open": day.todayOpens++; break;
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
  if (hasMalformedBetaLog(userId)) return;
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
    storage?.removeItem(`${TIMER_PREFIX}${encodeURIComponent(userId)}`);
    notifyParticipationChanged(userId);
  } catch { /* Best effort; UI can surface unavailable storage. */ }
}
