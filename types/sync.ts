export type SyncOperationKind =
  | "word-state"
  | "learning-event"
  | "learner-auxiliary"
  | "reading-document"
  | "reading-progress"
  | "personal-sentence"
  | "today-event";

export interface SyncOperation {
  id: string;
  kind: SyncOperationKind;
  entityId: string;
  version: number;
  createdAt: string;
  payload: unknown;
}

export interface FlushResult {
  applied: number;
  remaining: number;
  retryAt: string | null;
}
