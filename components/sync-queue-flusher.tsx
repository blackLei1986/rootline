"use client";

import { useEffect } from "react";
import { flushSyncQueue, SYNC_QUEUE_EVENT } from "@/lib/sync/offline-queue";

export function SyncQueueFlusher() {
  useEffect(() => {
    let active = true;
    let flushing = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function flush() {
      if (!active || flushing || !navigator.onLine) return;
      flushing = true;
      const result = await flushSyncQueue();
      flushing = false;
      if (!active || !result.retryAt) return;
      const delay = Math.max(1_000, new Date(result.retryAt).getTime() - Date.now());
      retryTimer = setTimeout(() => void flush(), delay);
    }

    const requestFlush = () => void flush();
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

  return null;
}
