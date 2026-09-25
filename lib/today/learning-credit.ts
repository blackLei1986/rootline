import {recordWordAnswer, markWordIntroduced} from "@/lib/learning-actions";
import {recordWordRecognition} from "@/lib/recognition-progress";
import {queueWordStateSync} from "@/lib/storage";
import type {TodayEventInput} from "@/lib/today/events";

const PENDING_PREFIX = "rootline-today-pending:";

export function hasTodayLearningCredit(event: TodayEventInput): boolean {
  return event.type === "target_recognized" || event.type === "target_activity_completed" || event.type === "review_answered";
}

export function savePendingTodayCredit(event: TodayEventInput): void {
  if (!hasTodayLearningCredit(event)) return;
  window.localStorage.setItem(PENDING_PREFIX + event.planId, JSON.stringify(event));
}

export function readPendingTodayCredit(planId: string): TodayEventInput | null {
  const raw = window.localStorage.getItem(PENDING_PREFIX + planId);
  if (!raw) return null;
  try {
    const event = JSON.parse(raw) as TodayEventInput;
    return event.planId === planId && typeof event.operationId === "string" && hasTodayLearningCredit(event) ? event : null;
  } catch { return null; }
}

export function clearPendingTodayCredit(planId: string): void {
  window.localStorage.removeItem(PENDING_PREFIX + planId);
}

export async function wasTodayCreditAccepted(event: TodayEventInput): Promise<boolean> {
  const query = new URLSearchParams({planId: event.planId, operationId: event.operationId});
  const response = await fetch(`/api/today/events?${query}`, {cache: "no-store"});
  if (!response.ok) throw new Error("TODAY_OPERATION_STATUS_UNAVAILABLE");
  const result = await response.json() as {applied?: unknown};
  if (typeof result.applied !== "boolean") throw new Error("TODAY_OPERATION_STATUS_INVALID");
  return result.applied;
}

/** A negative status read can race a still-running POST. Replay the same ID, never a new event. */
export async function reconcilePendingTodayCredit(event: TodayEventInput): Promise<boolean> {
  if (await wasTodayCreditAccepted(event)) return true;
  const response = await fetch("/api/today/events", {method: "POST", headers: {"content-type": "application/json"},
    body: JSON.stringify(event)});
  if (response.ok) return true;
  if (response.status === 409) return wasTodayCreditAccepted(event);
  throw new Error("TODAY_OPERATION_REPLAY_UNAVAILABLE");
}

export function creditAcceptedTodayEvent(event: TodayEventInput): void {
  if (!hasTodayLearningCredit(event) || !event.targetId) return;
  const now = new Date(event.occurredAt);
  if (event.type === "target_recognized" && event.recognitionState) {
    recordWordRecognition(event.targetId, event.recognitionState, 1000,
      event.recognitionState === "known", event.planId, now, event.operationId);
    if (event.recognitionState === "known") markWordIntroduced(event.targetId, now);
  } else if (event.type === "target_activity_completed" && event.activity) {
    if (event.activity === "learning-card") markWordIntroduced(event.targetId, now);
    else recordWordAnswer(event.targetId, event.correct ? "good" : "again", event.correct === true,
      now, {mode: `today-${event.activity}`}, event.operationId);
  } else if (event.type === "review_answered" && event.reviewKind) {
    recordWordAnswer(event.targetId, event.correct ? "good" : "again", event.correct === true,
      now, {mode: `today-${event.reviewKind}-review`}, event.operationId);
  }
  queueWordStateSync(event.targetId);
}
