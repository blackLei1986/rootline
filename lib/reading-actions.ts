import { createWordProgress, loadProgress, saveProgress } from "@/lib/storage";

export function recordReadingEncounter(wordId: string, kind: "seen" | "lookup" | "learn", documentId: string, now = new Date()): void {
  const storage = loadProgress();
  const current = storage.words[wordId] ?? createWordProgress(wordId);
  const firstSeenSource = current.firstSeenSource ?? "reading";
  const lookupPenalty = kind === "lookup" && current.recognitionState === "known" ? 6 : 0;
  saveProgress({
    ...storage,
    words: {
      ...storage.words,
      [wordId]: {
        ...current,
        firstSeenSource,
        recognitionConfidence: Math.max(0, current.recognitionConfidence - lookupPenalty),
        verificationDue: current.verificationDue || (kind === "lookup" && current.recognitionState === "known"),
        encounters: {
          ...current.encounters,
          totalCount: current.encounters.totalCount + 1,
          readingCount: current.encounters.readingCount + 1,
          lastEncounterAt: now.toISOString()
        }
      }
    },
    events: [...storage.events, {
      id: `${now.getTime()}-${documentId}-${wordId}-${kind}`,
      type: kind === "lookup" ? "reading_lookup" as const : "reading_encounter" as const,
      timestamp: now.toISOString(),
      wordId,
      metadata: { documentId, kind }
    }].slice(-500)
  });
}

export async function markArticleCompleted(articleId: string): Promise<boolean> {
  const response = await fetch(`/api/articles/${encodeURIComponent(articleId)}/state`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ completed: true })
  });
  return response.ok;
}
