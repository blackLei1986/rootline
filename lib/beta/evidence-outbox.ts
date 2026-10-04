import { parseBetaEvidenceSubmission, type BetaEvidenceSubmission } from "@/lib/beta/evidence-schema";
import type { BetaEvent } from "@/lib/beta/validation-store";

const PREFIX = "rootline:beta-evidence:outbox:v1:";
const inFlight = new Set<string>();
let enqueueSequence = 0;

function accountPrefix(userId: string): string {
  return `${PREFIX}${encodeURIComponent(userId)}:`;
}

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function readingToken(sessionId: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (const byte of new TextEncoder().encode(sessionId)) {
    first = Math.imul(first ^ byte, 0x01000193);
    second = Math.imul(second ^ byte, 0x85ebca6b);
  }
  return [first, second].map((part) => (part >>> 0).toString(16).padStart(8, "0")).join("");
}

function serverEvent(event: BetaEvent): unknown {
  if (event.type === "reading-observed" || event.type === "reading-completed") {
    return { type: event.type, sessionToken: readingToken(event.sessionId) };
  }
  return event;
}

function pendingKeys(userId: string): string[] {
  const target = storage();
  if (!target) return [];
  const prefix = accountPrefix(userId);
  const keys: string[] = [];
  for (let index = 0; index < target.length; index++) {
    const key = target.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

export function enqueueBetaEvidence(userId: string, learningDate: string, event: BetaEvent, eventKey = `event:${crypto.randomUUID()}`): string | null {
  const target = storage();
  if (!target) return null;
  try {
    const submission = parseBetaEvidenceSubmission({ eventKey, learningDate, event: serverEvent(event) });
    const key = `${accountPrefix(userId)}${eventKey}`;
    if (target.getItem(key) === null) target.setItem(key, JSON.stringify({ submission, queuedAt: Date.now(), sequence: ++enqueueSequence }));
    return eventKey;
  } catch { return null; }
}

async function sendToServer(record: BetaEvidenceSubmission): Promise<boolean> {
  try {
    const response = await fetch("/api/beta/evidence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      keepalive: true,
      body: JSON.stringify(record),
    });
    return response.ok;
  } catch { return false; }
}

export async function flushBetaEvidence(userId: string, sender: (record: BetaEvidenceSubmission) => Promise<boolean> = sendToServer): Promise<void> {
  const target = storage();
  if (!target || inFlight.has(userId)) return;
  inFlight.add(userId);
  try {
    const pending = pendingKeys(userId).flatMap((key) => {
      const raw = target.getItem(key);
      if (!raw) return [];
      try {
        const parsed: unknown = JSON.parse(raw);
        const wrapper = parsed && typeof parsed === "object" && "submission" in parsed ? parsed as { submission: unknown; queuedAt?: unknown; sequence?: unknown } : { submission: parsed };
        return [{ key, raw, record: parseBetaEvidenceSubmission(wrapper.submission), queuedAt: typeof wrapper.queuedAt === "number" ? wrapper.queuedAt : 0, sequence: typeof wrapper.sequence === "number" ? wrapper.sequence : 0 }];
      } catch { return []; }
    }).sort((a, b) => a.queuedAt - b.queuedAt || a.sequence - b.sequence || a.key.localeCompare(b.key));
    for (const item of pending) {
      if (!await sender(item.record)) break;
      if (target.getItem(item.key) === item.raw) target.removeItem(item.key);
    }
  } finally {
    inFlight.delete(userId);
  }
}

export function clearBetaEvidenceOutbox(userId: string): void {
  const target = storage();
  if (!target) return;
  for (const key of pendingKeys(userId)) target.removeItem(key);
}
