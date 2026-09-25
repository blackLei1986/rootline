import { getStorageAdapter, type StorageAdapter } from "@/lib/storage-adapter";
import type { FlushResult, SyncOperation } from "@/types/sync";

export const SYNC_QUEUE_KEY = "rootline-sync-queue";
export const SYNC_QUEUE_EVENT = "rootline-sync-queue-updated";
const MAX_QUEUE_LENGTH = 2_000;
const activeFlushes = new WeakMap<StorageAdapter, Promise<FlushResult>>();

type SyncTransport = (operation: SyncOperation) => Promise<void>;

type FlushOptions = {
  adapter?: StorageAdapter;
  transport?: SyncTransport;
  now?: () => Date;
};

export class SyncConflictError extends Error {
  constructor(message = "READING_REVISION_CONFLICT") { super(message); }
}

export function enqueueSyncOperation(
  operation: SyncOperation,
  adapter: StorageAdapter = getStorageAdapter()
): void {
  const queue = readSyncQueue(adapter);
  if (queue.some((item) => item.id === operation.id)) return;
  const replaceIndex = isCoalescable(operation)
    ? queue.findIndex(
        (item) => item.kind === operation.kind && item.entityId === operation.entityId
      )
    : -1;
  const next = [...queue];
  if (replaceIndex >= 0) next[replaceIndex] = operation;
  else next.push(operation);
  writeSyncQueue(next.slice(-MAX_QUEUE_LENGTH), adapter);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SYNC_QUEUE_EVENT));
}

export function queueSyncPayload(
  kind: SyncOperation["kind"],
  entityId: string,
  payload: unknown,
  version = Math.floor(Date.now() / 1_000)
): void {
  if (typeof window === "undefined") return;
  enqueueSyncOperation({
    id: crypto.randomUUID(),
    kind,
    entityId,
    version: Math.max(1, version),
    createdAt: new Date().toISOString(),
    payload
  });
}

function isCoalescable(operation: SyncOperation): boolean {
  return [
    "word-state",
    "learner-auxiliary",
    "reading-document",
    "reading-progress"
  ].includes(operation.kind);
}

export function readSyncQueue(
  adapter: StorageAdapter = getStorageAdapter()
): SyncOperation[] {
  const raw = adapter.getItem(SYNC_QUEUE_KEY);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as SyncOperation[]) : [];
  } catch {
    return [];
  }
}

export function listPendingWordOperations(
  wordId: string, adapter: StorageAdapter = getStorageAdapter()
): SyncOperation[] {
  return readSyncQueue(adapter).filter((operation) =>
    (operation.kind === "word-state" && operation.entityId === wordId)
    || (operation.kind === "learning-event" && typeof operation.payload === "object"
      && operation.payload !== null && "wordId" in operation.payload
      && operation.payload.wordId === wordId));
}

export function discardConflictingWordStateOperation(
  operationId: string, wordId: string, adapter: StorageAdapter = getStorageAdapter()
): boolean {
  const queue = readSyncQueue(adapter);
  const operation = queue.find((item) => item.id === operationId);
  if (operation?.kind !== "word-state" || operation.entityId !== wordId) return false;
  writeSyncQueue(queue.filter((item) => item.id !== operationId), adapter);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SYNC_QUEUE_EVENT));
  return true;
}

export async function flushSyncQueue(options: FlushOptions = {}): Promise<FlushResult> {
  const adapter = options.adapter ?? getStorageAdapter();
  const active = activeFlushes.get(adapter);
  if (active) return active;
  const run = flushWithBrowserLock(() => flushSyncQueueUnlocked({...options, adapter}));
  activeFlushes.set(adapter, run);
  try { return await run; }
  finally { if (activeFlushes.get(adapter) === run) activeFlushes.delete(adapter); }
}

async function flushWithBrowserLock(run: () => Promise<FlushResult>): Promise<FlushResult> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(SYNC_QUEUE_KEY, run);
  }
  return run();
}

async function flushSyncQueueUnlocked(options: FlushOptions): Promise<FlushResult> {
  const adapter = options.adapter ?? getStorageAdapter();
  const transport = options.transport ?? sendOperation;
  const now = options.now ?? (() => new Date());
  let queue = readSyncQueue(adapter);
  let applied = 0;

  while (queue.length > 0) {
    const operation = queue[0];
    try {
      await transport(operation);
      queue = readSyncQueue(adapter).filter((item) => item.id !== operation.id);
      writeSyncQueue(queue, adapter);
      applied += 1;
    } catch (error) {
      queue = readSyncQueue(adapter);
      if (error instanceof SyncConflictError) {
        if (!queue.some((item) => item.id === operation.id)) continue;
        return { applied, remaining: queue.length, retryAt: null,
          conflict: {operationId: operation.id, entityId: operation.entityId} };
      }
      return {
        applied,
        remaining: queue.length,
        retryAt: new Date(now().getTime() + 30_000).toISOString()
      };
    }
  }

  return { applied, remaining: readSyncQueue(adapter).length, retryAt: null };
}

function writeSyncQueue(queue: SyncOperation[], adapter: StorageAdapter): void {
  adapter.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

async function sendOperation(operation: SyncOperation): Promise<void> {
  const response = await fetch("/api/sync/operations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(operation)
  });
  if (response.status === 409) {
    const body = await response.json().catch(() => null) as {code?: string} | null;
    if (body?.code === "READING_REVISION_CONFLICT") throw new SyncConflictError();
  }
  if (!response.ok) throw new Error("Sync operation failed.");
}
