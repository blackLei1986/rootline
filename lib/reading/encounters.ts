export interface ArticleEncounterInput {
  userId: string;
  wordId: string;
  articleId: string;
  sourceKey: string;
  occurrenceCount: number;
  occurredAt: string;
  operationId: string;
}

export interface ArticleEncounterRow {
  userId: string;
  wordId: string;
  articleId: string;
  sourceKey: string;
  occurrenceCount: number;
  firstEncounteredAt: string;
  lastEncounteredAt: string;
}

export interface EncounterSummary {
  totalOccurrences: number;
  distinctArticles: number;
  distinctSources: number;
  lastEncounterAt: string;
}

export interface ArticleEncounterStore {
  operationWasApplied(userId: string, operationId: string): Promise<boolean>;
  getEncounter(userId: string, wordId: string, articleId: string): Promise<ArticleEncounterRow | null>;
  saveEncounter(row: ArticleEncounterRow, operationId: string): Promise<void>;
  listEncounters(userId: string, wordId: string): Promise<ArticleEncounterRow[]>;
}

export async function recordArticleEncounter(
  input: ArticleEncounterInput,
  store: ArticleEncounterStore
): Promise<EncounterSummary> {
  validate(input);
  if (!await store.operationWasApplied(input.userId, input.operationId)) {
    const current = await store.getEncounter(input.userId, input.wordId, input.articleId);
    await store.saveEncounter({
      userId: input.userId,
      wordId: input.wordId,
      articleId: input.articleId,
      sourceKey: input.sourceKey,
      occurrenceCount: Math.max(current?.occurrenceCount ?? 0, input.occurrenceCount),
      firstEncounteredAt: current?.firstEncounteredAt ?? input.occurredAt,
      lastEncounteredAt: latest(current?.lastEncounteredAt, input.occurredAt)
    }, input.operationId);
  }
  return summarize(await store.listEncounters(input.userId, input.wordId));
}

function summarize(rows: ArticleEncounterRow[]): EncounterSummary {
  return {
    totalOccurrences: rows.reduce((total, row) => total + row.occurrenceCount, 0),
    distinctArticles: new Set(rows.map((row) => row.articleId)).size,
    distinctSources: new Set(rows.map((row) => row.sourceKey).filter(Boolean)).size,
    lastEncounterAt: rows.reduce((latestValue, row) => latest(latestValue, row.lastEncounteredAt), "")
  };
}

function validate(input: ArticleEncounterInput): void {
  if (!input.userId || !input.wordId || !input.articleId || !input.sourceKey || !input.operationId) {
    throw new Error("Article encounter is incomplete.");
  }
  if (!Number.isInteger(input.occurrenceCount) || input.occurrenceCount < 1) {
    throw new Error("Article encounter occurrence count must be positive.");
  }
  if (Number.isNaN(Date.parse(input.occurredAt))) throw new Error("Article encounter timestamp is invalid.");
}

function latest(left: string | undefined, right: string): string {
  if (!left) return right;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}
