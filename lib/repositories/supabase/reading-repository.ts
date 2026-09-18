import type { ReadingRepository } from "@/lib/repositories/contracts";
import {
  operationWasApplied,
  recordOperation,
  throwRepositoryError,
  toJson,
  type DatabaseClient
} from "@/lib/repositories/supabase/shared";
import type { ReadingDocument, ReadingProgress } from "@/types/reading";

export class SupabaseReadingRepository implements ReadingRepository {
  constructor(private readonly client: DatabaseClient) {}

  async listDocuments(userId: string): Promise<ReadingDocument[]> {
    const { data, error } = await this.client
      .from("reading_documents")
      .select("id,title,source_type,document_text,analysis,analysis_version,document_created_at")
      .eq("user_id", userId)
      .order("document_created_at", { ascending: false });
    throwRepositoryError(error, "load reading documents");

    return (data ?? []).map((row) => ({
      ...(row.analysis as unknown as ReadingDocument),
      id: row.id,
      ...(row.title ? { title: row.title } : {}),
      text: row.document_text,
      sourceType: row.source_type as ReadingDocument["sourceType"],
      createdAt: row.document_created_at,
      analysisVersion: row.analysis_version
    }));
  }

  async saveDocument(
    userId: string,
    document: ReadingDocument,
    operationId: string
  ): Promise<void> {
    if (await operationWasApplied(this.client, userId, operationId)) return;

    const { error } = await this.client.from("reading_documents").upsert(
      {
        user_id: userId,
        id: document.id,
        title: document.title ?? null,
        source_type: document.sourceType,
        document_text: document.text,
        analysis: toJson(document),
        analysis_version: document.analysisVersion,
        document_created_at: document.createdAt
      },
      { onConflict: "user_id,id" }
    );
    throwRepositoryError(error, "save reading document");
    await recordOperation(this.client, {
      userId,
      operationId,
      kind: "reading-document",
      entityId: document.id
    });
  }

  async saveProgress(
    userId: string,
    progress: ReadingProgress,
    operationId: string
  ): Promise<void> {
    if (await operationWasApplied(this.client, userId, operationId)) return;

    const { error } = await this.client.from("reading_progress").upsert(
      {
        user_id: userId,
        document_id: progress.documentId,
        progress: toJson(progress),
        version: 1,
        client_updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,document_id" }
    );
    throwRepositoryError(error, "save reading progress");
    await recordOperation(this.client, {
      userId,
      operationId,
      kind: "reading-progress",
      entityId: progress.documentId
    });
  }
}
