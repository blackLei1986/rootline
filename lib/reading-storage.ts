import type { PersonalSentence, ReadingDocument, ReadingLearningItem, ReadingProgress, ReadingStore } from "@/types/reading";
import { getStorageAdapter } from "@/lib/storage-adapter";
import { queueSyncPayload } from "@/lib/sync/offline-queue";

export const READING_STORAGE_KEY = "rootline-reading-store";
export const READING_STORAGE_VERSION = 1;

const EMPTY: ReadingStore = { version: READING_STORAGE_VERSION, documents: {}, progress: {}, learningQueue: [], personalSentences: [] };

function load(): ReadingStore {
  if (typeof window === "undefined") return structuredClone(EMPTY);
  try {
    const raw = getStorageAdapter().getItem(READING_STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY);
    const value = JSON.parse(raw) as Partial<ReadingStore>;
    return { version: READING_STORAGE_VERSION, documents: value.documents ?? {}, progress: value.progress ?? {}, learningQueue: value.learningQueue ?? [], personalSentences: value.personalSentences ?? [] };
  } catch {
    return structuredClone(EMPTY);
  }
}

function save(store: ReadingStore): ReadingStore {
  if (typeof window !== "undefined") getStorageAdapter().setItem(READING_STORAGE_KEY, JSON.stringify(store));
  return store;
}

export const readingStorage = {
  listDocuments: (): ReadingDocument[] => Object.values(load().documents).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  getDocument: (id: string): ReadingDocument | null => load().documents[id] ?? null,
  saveDocument(document: ReadingDocument): ReadingDocument {
    const store = load();
    const progress = store.progress[document.id] ?? { documentId: document.id, startedAt: new Date().toISOString(), clickedWordIds: [], learnedWordIds: [], unknownBefore: document.coverage.unknownContentWords, coverageBefore: document.coverage.contentWordCoverage };
    save({ ...store, documents: { ...store.documents, [document.id]: document }, progress: { ...store.progress, [document.id]: progress } });
    queueSyncPayload("reading-document", document.id, document);
    queueSyncPayload("reading-progress", document.id, progress);
    return document;
  },
  deleteDocument(id: string): void {
    const store = load();
    const documents = { ...store.documents }; const progress = { ...store.progress };
    delete documents[id]; delete progress[id];
    save({ ...store, documents, progress, learningQueue: store.learningQueue.filter((item) => item.documentId !== id), personalSentences: store.personalSentences.filter((item) => item.documentId !== id) });
  },
  getProgress: (id: string): ReadingProgress | null => load().progress[id] ?? null,
  saveProgress(progress: ReadingProgress): void { const store = load(); save({ ...store, progress: { ...store.progress, [progress.documentId]: progress } }); queueSyncPayload("reading-progress", progress.documentId, progress); },
  enqueue(items: ReadingLearningItem[]): void {
    const store = load();
    const keys = new Set(store.learningQueue.map((item) => `${item.documentId}:${item.wordId}`));
    save({ ...store, learningQueue: [...store.learningQueue, ...items.filter((item) => !keys.has(`${item.documentId}:${item.wordId}`))] });
  },
  completeQueue(documentId: string, wordIds: string[]): void {
    const store = load(); const completed = new Set(wordIds);
    save({ ...store, learningQueue: store.learningQueue.map((item) => item.documentId === documentId && completed.has(item.wordId) ? { ...item, status: "completed" as const } : item) });
  },
  getQueue: (documentId?: string): ReadingLearningItem[] => load().learningQueue.filter((item) => !documentId || item.documentId === documentId),
  saveSentence(sentence: PersonalSentence): void { const store = load(); if (!store.personalSentences.some((item) => item.id === sentence.id)) { save({ ...store, personalSentences: [...store.personalSentences, sentence] }); queueSyncPayload("personal-sentence", sentence.id, sentence); } },
  listSentences: (documentId?: string): PersonalSentence[] => load().personalSentences.filter((item) => !documentId || item.documentId === documentId)
};
