import { EMPTY_STORAGE, migrateStorage } from "@/lib/storage";
import type {
  LearnerRepository,
  ReadingRepository,
  TodayRepository
} from "@/lib/repositories/contracts";
import type { LearningEvent, LearningStorage, WordProgress } from "@/types/progress";
import type { ReadingDocument, ReadingProgress } from "@/types/reading";
import type { TodayPlan } from "@/types/today";

type LearnerRecord = {
  storage: LearningStorage;
  operationIds: Set<string>;
  eventIds: Set<string>;
};

export class MemoryLearnerRepository implements LearnerRepository {
  private readonly users = new Map<string, LearnerRecord>();

  async getSnapshot(userId: string): Promise<LearningStorage> {
    return structuredClone(this.getUser(userId).storage);
  }

  async upsertWordState(
    userId: string,
    state: WordProgress,
    operationId: string
  ): Promise<void> {
    const user = this.getUser(userId);
    if (user.operationIds.has(operationId)) return;

    user.storage.words[state.wordId] = structuredClone(state);
    user.operationIds.add(operationId);
  }

  async appendEvents(userId: string, events: LearningEvent[]): Promise<number> {
    const user = this.getUser(userId);
    const uniqueEvents = events.filter((event) => !user.eventIds.has(event.id));

    for (const event of uniqueEvents) {
      user.eventIds.add(event.id);
      user.storage.events.push(structuredClone(event));
    }
    user.storage.events = user.storage.events.slice(-500);
    return uniqueEvents.length;
  }

  async saveAuxiliaryState(
    userId: string,
    storage: LearningStorage,
    operationId: string
  ): Promise<void> {
    const user = this.getUser(userId);
    if (user.operationIds.has(operationId)) return;

    user.storage = migrateStorage({
      ...user.storage,
      version: storage.version,
      roots: structuredClone(storage.roots),
      dailyStats: structuredClone(storage.dailyStats),
      calibration: structuredClone(storage.calibration),
      settings: structuredClone(storage.settings),
      transferStats: structuredClone(storage.transferStats)
    });
    user.operationIds.add(operationId);
  }

  private getUser(userId: string): LearnerRecord {
    const existing = this.users.get(userId);
    if (existing) return existing;

    const created = {
      storage: structuredClone(EMPTY_STORAGE),
      operationIds: new Set<string>(),
      eventIds: new Set<string>()
    };
    this.users.set(userId, created);
    return created;
  }
}

type ReadingRecord = {
  documents: Map<string, ReadingDocument>;
  progress: Map<string, ReadingProgress>;
  operationIds: Set<string>;
};

export class MemoryReadingRepository implements ReadingRepository {
  private readonly users = new Map<string, ReadingRecord>();

  async listDocuments(userId: string): Promise<ReadingDocument[]> {
    return [...this.getUser(userId).documents.values()]
      .map((document) => structuredClone(document))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async saveDocument(
    userId: string,
    document: ReadingDocument,
    operationId: string
  ): Promise<void> {
    const user = this.getUser(userId);
    if (user.operationIds.has(operationId)) return;

    user.documents.set(document.id, structuredClone(document));
    user.operationIds.add(operationId);
  }

  async saveProgress(
    userId: string,
    progress: ReadingProgress,
    operationId: string
  ): Promise<void> {
    const user = this.getUser(userId);
    if (user.operationIds.has(operationId)) return;

    user.progress.set(progress.documentId, structuredClone(progress));
    user.operationIds.add(operationId);
  }

  private getUser(userId: string): ReadingRecord {
    const existing = this.users.get(userId);
    if (existing) return existing;

    const created = {
      documents: new Map<string, ReadingDocument>(),
      progress: new Map<string, ReadingProgress>(),
      operationIds: new Set<string>()
    };
    this.users.set(userId, created);
    return created;
  }
}

type TodayRecord = {
  plans: Map<string, TodayPlan>;
  operationIds: Set<string>;
};

export class MemoryTodayRepository implements TodayRepository {
  private readonly users = new Map<string, TodayRecord>();

  async getPlan(userId: string, date: string): Promise<TodayPlan | null> {
    const plan = this.getUser(userId).plans.get(date);
    return plan ? structuredClone(plan) : null;
  }

  async savePlan(userId: string, plan: TodayPlan, operationId: string): Promise<void> {
    const user = this.getUser(userId);
    if (user.operationIds.has(operationId)) return;

    user.plans.set(plan.date, structuredClone(plan));
    user.operationIds.add(operationId);
  }

  private getUser(userId: string): TodayRecord {
    const existing = this.users.get(userId);
    if (existing) return existing;

    const created = {
      plans: new Map<string, TodayPlan>(),
      operationIds: new Set<string>()
    };
    this.users.set(userId, created);
    return created;
  }
}
