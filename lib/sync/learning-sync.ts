import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { RepositoryError } from "@/lib/repositories/contracts";
import { toJson } from "@/lib/repositories/supabase/shared";
import type { Database } from "@/types/database";
import type { SyncOperation } from "@/types/sync";

export async function applySyncOperation(
  client: SupabaseClient<Database>,
  userId: string,
  operation: SyncOperation
): Promise<boolean> {
  const args = {
    p_user_id: userId,
    p_operation_id: operation.id,
    p_entity_id: operation.entityId,
    p_version: operation.version,
    p_payload: toJson(operation.payload)
  };
  const { data, error } = operation.kind === "word-state"
    ? await client.rpc("apply_guarded_word_state", args)
    : await client.rpc("apply_sync_operation", {...args, p_kind: operation.kind});
  if (error) {
    if (error.code === "P0001" && error.message.includes("READING_REVISION_CONFLICT")) {
      throw new WordStateRevisionConflictError();
    }
    throw new RepositoryError(
      "PERSISTENCE_UNAVAILABLE",
      "Unable to apply sync operation.",
      error
    );
  }
  return data;
}

export class WordStateRevisionConflictError extends Error {
  constructor() { super("READING_REVISION_CONFLICT"); }
}
