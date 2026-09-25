"use client";

import { useEffect, useState } from "react";
import { hydrateAuthoritativeWordState } from "@/lib/storage";
import {
  discardConflictingWordStateOperation, flushSyncQueue, listPendingWordOperations, readSyncQueue, SYNC_QUEUE_EVENT
} from "@/lib/sync/offline-queue";
import type { WordProgress } from "@/types/progress";

export function SyncQueueFlusher() {
  const [conflict, setConflict] = useState<{operationId: string; entityId: string} | null>(null);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let active = true;
    let flushing = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function flush() {
      if (!active || flushing) return;
      setPendingCount(readSyncQueue().length);
      if (!navigator.onLine) return;
      flushing = true;
      let result;
      try { result = await flushSyncQueue(); }
      catch { setError("同步暂时不可用；本地修改仍保留。"); flushing = false; return; }
      flushing = false;
      if (!active) return;
      setPendingCount(result.remaining);
      if (result.conflict) {
        setConflict(result.conflict);
        setExported(false);
        return;
      }
      if (!active || !result.retryAt) return;
      const delay = Math.max(1_000, new Date(result.retryAt).getTime() - Date.now());
      retryTimer = setTimeout(() => void flush(), delay);
    }

    const requestFlush = () => { setPendingCount(readSyncQueue().length); void flush(); };
    window.addEventListener("online", requestFlush);
    window.addEventListener(SYNC_QUEUE_EVENT, requestFlush);
    void flush();

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("online", requestFlush);
      window.removeEventListener(SYNC_QUEUE_EVENT, requestFlush);
    };
  }, []);

  async function chooseCloudVersion() {
    if (!conflict || !exported || resolving) return;
    if (!window.confirm(`本地 ${conflict.entityId} 的待同步修改将被移除。已导出备份，确定使用云端版本吗？`)) return;
    setResolving(true);
    setError(null);
    try {
      const response = await fetch(`/api/sync/word-states/${encodeURIComponent(conflict.entityId)}`, {cache: "no-store"});
      if (!response.ok) throw new Error("word-state fetch failed");
      const body = await response.json() as {wordState?: WordProgress};
      const state = body.wordState;
      if (!state || state.wordId !== conflict.entityId || !Number.isInteger(state.readingRevision)) {
        throw new Error("invalid word-state response");
      }
      if (!discardConflictingWordStateOperation(conflict.operationId, conflict.entityId)) {
        throw new Error("conflicting operation changed");
      }
      hydrateAuthoritativeWordState(conflict.entityId, state);
      setConflict(null);
      setExported(false);
      window.dispatchEvent(new Event(SYNC_QUEUE_EVENT));
    } catch {
      setError("云端版本暂时无法读取，本地修改仍保留。请稍后重试。");
    } finally {
      setResolving(false);
    }
  }

  if (!conflict) return pendingCount > 0 ? <aside role="status" className="fixed bottom-16 right-4 z-50 max-w-sm rounded-xl border border-amber-300 bg-white p-4 shadow-lg md:bottom-4">
    <p>{pendingCount} 项等待同步，本地修改仍保留，尚未保存到云端。</p>
    {error && <p>{error}</p>}
    <button type="button" className="mt-2 font-semibold text-[var(--primary)]" onClick={() => window.dispatchEvent(new Event(SYNC_QUEUE_EVENT))}>重试同步</button>
  </aside> : null;
  const pending = listPendingWordOperations(conflict.entityId);
  const exportUrl = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(pending, null, 2))}`;
  return <aside role="alert" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-amber-300 bg-white p-4 shadow-lg">
    <p>词汇 {conflict.entityId} 的本地修改与云端阅读练习冲突，已暂停自动同步，未覆盖任何一方。</p>
    {error && <p>{error}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <a href={exportUrl} download={`rootline-${conflict.entityId}-pending.json`} onClick={() => setExported(true)}>导出本地修改</a>
      <button type="button" disabled={!exported || resolving} onClick={() => void chooseCloudVersion()}>使用云端版本</button>
      <button type="button" onClick={() => setConflict(null)}>稍后处理</button>
    </div>
  </aside>;
}
