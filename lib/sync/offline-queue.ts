import { getStorageAdapter, type StorageAdapter } from "@/lib/storage-adapter";
import type { FlushResult, SyncOperation } from "@/types/sync";

export const SYNC_QUEUE_KEY = "rootline-sync-queue";
export const SYNC_QUEUE_EVENT = "rootline-sync-queue-updated";
const MAX_QUEUE_LENGTH = 2_000;

type SyncTransport = (operation: SyncOperation) => Promise<void>;

type FlushOptions = {
  adapter?: StorageAdapter;
  transport?: SyncTransport;
  now?: () => Date;
};

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

export async function flushSyncQueue(options: FlushOptions = {}): Promise<FlushResult> {
  const adapter = options.adapter ?? getStorageAdapter();
  const transport = options.transport ?? sendOperation;
  const now = options.now ?? (() => new Date());
  let queue = readSyncQueue(adapter);
  let applied = 0;

  while (queue.length > 0) {
    try {
      await transport(queue[0]);
      queue = queue.slice(1);
      writeSyncQueue(queue, adapter);
      applied += 1;
    } catch {
      return {
        applied,
        remaining: queue.length,
        retryAt: new Date(now().getTime() + 30_000).toISOString()
      };
    }
  }

  return { applied, remaining: 0, retryAt: null };
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
  if (!response.ok) throw new Error("Sync operation failed.");
}
