import type { SupabaseClient } from "@supabase/supabase-js";
import type { RepositoryErrorCode } from "@/lib/repositories/contracts";
import { RepositoryError } from "@/lib/repositories/contracts";
import type { Database, Json } from "@/types/database";

export type DatabaseClient = SupabaseClient<Database>;

type ProviderError = {
  code?: string;
  message?: string;
};

export function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function throwRepositoryError(error: ProviderError | null, action: string): void {
  if (!error) return;

  const code: RepositoryErrorCode =
    error.code === "23505"
      ? "CONFLICT"
      : error.code === "PGRST116"
        ? "NOT_FOUND"
        : "PERSISTENCE_UNAVAILABLE";
  throw new RepositoryError(code, `Unable to ${action}.`, error);
}

export async function operationWasApplied(
  client: DatabaseClient,
  userId: string,
  operationId: string
): Promise<boolean> {
  const { data, error } = await client
    .from("sync_operations")
    .select("operation_id")
    .eq("user_id", userId)
    .eq("operation_id", operationId)
    .maybeSingle();
  throwRepositoryError(error, "check operation state");
  return data !== null;
}

export async function recordOperation(
  client: DatabaseClient,
  input: {
    userId: string;
    operationId: string;
    kind:
      | "word-state"
      | "learning-event"
      | "learner-auxiliary"
      | "reading-document"
      | "reading-progress"
      | "personal-sentence"
      | "today-plan"
      | "today-event";
    entityId: string;
    version?: number;
  }
): Promise<void> {
  const { error } = await client.from("sync_operations").insert({
    user_id: input.userId,
    operation_id: input.operationId,
    operation_kind: input.kind,
    entity_id: input.entityId,
    entity_version: input.version ?? 1
  });

  if (error?.code === "23505") return;
  throwRepositoryError(error, "record operation state");
}
