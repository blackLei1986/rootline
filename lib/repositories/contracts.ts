import type { LearningEvent, LearningStorage, WordProgress } from "@/types/progress";
import type { ReadingDocument, ReadingProgress } from "@/types/reading";
import type { TodayPlan } from "@/types/today";

export type RepositoryErrorCode =
  | "CONFLICT"
  | "NOT_FOUND"
  | "PERSISTENCE_UNAVAILABLE"
  | "UNKNOWN";

export class RepositoryError extends Error {
  constructor(
    public readonly code: RepositoryErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

export interface LearnerRepository {
  getSnapshot(userId: string): Promise<LearningStorage>;
  upsertWordState(userId: string, state: WordProgress, operationId: string): Promise<void>;
  appendEvents(userId: string, events: LearningEvent[]): Promise<number>;
  saveAuxiliaryState(
    userId: string,
    storage: LearningStorage,
    operationId: string
  ): Promise<void>;
}

export interface ReadingRepository {
  listDocuments(userId: string): Promise<ReadingDocument[]>;
  saveDocument(userId: string, document: ReadingDocument, operationId: string): Promise<void>;
  saveProgress(userId: string, progress: ReadingProgress, operationId: string): Promise<void>;
}

export interface TodayRepository {
  getPlan(userId: string, date: string): Promise<TodayPlan | null>;
  savePlan(userId: string, plan: TodayPlan, operationId: string): Promise<void>;
}
