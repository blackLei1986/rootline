import { getBetaParticipation, isBetaLearningDate, recordBetaEvent } from "@/lib/beta/validation-store";

export type BetaActivity = "block-a" | "block-b" | "block-c" | "mini-review-a" | "mini-review-b" | "mini-review-c" | "final-review";
type TimerState = { learningDate: string; activity: BetaActivity; startedAt: number; paused: boolean };
const TIMER_PREFIX = "rootline:beta-validation:timer:v1:";
const ACTIVITIES = new Set<BetaActivity>(["block-a", "block-b", "block-c", "mini-review-a", "mini-review-b", "mini-review-c", "final-review"]);

function key(userId: string): string { return `${TIMER_PREFIX}${encodeURIComponent(userId)}`; }
function read(userId: string): TimerState | null {
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as TimerState;
    return isBetaLearningDate(value.learningDate) && ACTIVITIES.has(value.activity) && Number.isFinite(value.startedAt) && typeof value.paused === "boolean" ? value : null;
  } catch { return null; }
}
function write(userId: string, state: TimerState | null): void {
  try {
    if (state) window.localStorage.setItem(key(userId), JSON.stringify(state));
    else window.localStorage.removeItem(key(userId));
  } catch { /* Timer storage is optional; learning is not blocked. */ }
}
function addElapsed(userId: string, state: TimerState, now: number): void {
  if (!state.paused) recordBetaEvent(userId, state.learningDate, { type: "activity-duration", activity: state.activity, milliseconds: Math.max(0, Math.min(86_400_000, now - state.startedAt)) });
}

export function startBetaActivity(userId: string, learningDate: string, activity: BetaActivity): void {
  if (!getBetaParticipation(userId) || !isBetaLearningDate(learningDate) || !ACTIVITIES.has(activity)) return;
  switchBetaActivity(userId, learningDate, activity);
}

export function switchBetaActivity(userId: string, learningDate: string, activity: BetaActivity): void {
  if (!getBetaParticipation(userId) || !isBetaLearningDate(learningDate) || !ACTIVITIES.has(activity)) return;
  const prior = read(userId);
  if (prior?.learningDate === learningDate && prior.activity === activity && !prior.paused) return;
  if (prior?.learningDate === learningDate) addElapsed(userId, prior, Date.now());
  recordBetaEvent(userId, learningDate, { type: "session-started" });
  write(userId, { learningDate, activity, startedAt: Date.now(), paused: false });
}

export function pauseBetaActivity(userId: string, learningDate: string): void {
  const state = read(userId);
  if (!state || state.learningDate !== learningDate || state.paused) return;
  addElapsed(userId, state, Date.now());
  write(userId, { ...state, startedAt: Date.now(), paused: true });
}

export function resumeBetaActivity(userId: string, learningDate: string): void {
  if (!getBetaParticipation(userId)) return;
  const state = read(userId);
  if (!state || state.learningDate !== learningDate || !state.paused) return;
  write(userId, { ...state, startedAt: Date.now(), paused: false });
}

export function attachBetaVisibilityTracking(userId: string, learningDate: string): () => void {
  const updateVisibility = () => document.visibilityState === "hidden" ? pauseBetaActivity(userId, learningDate) : resumeBetaActivity(userId, learningDate);
  const onPageHide = () => pauseBetaActivity(userId, learningDate);
  document.addEventListener("visibilitychange", updateVisibility);
  window.addEventListener("pagehide", onPageHide);
  if (document.visibilityState === "hidden") pauseBetaActivity(userId, learningDate);
  return () => {
    document.removeEventListener("visibilitychange", updateVisibility);
    window.removeEventListener("pagehide", onPageHide);
    pauseBetaActivity(userId, learningDate);
  };
}
