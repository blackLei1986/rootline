import { getOptionalViewer } from "@/lib/auth/session";
import { SyncQueueFlusher } from "@/components/sync-queue-flusher";

export async function SyncQueueFlusherShell() {
  const viewer = await getOptionalViewer();
  if (!viewer?.emailVerified) return null;
  return <SyncQueueFlusher />;
}
