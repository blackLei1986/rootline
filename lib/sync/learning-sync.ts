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
  const { data, error } = await client.rpc("apply_sync_operation", {
    p_user_id: userId,
    p_operation_id: operation.id,
    p_kind: operation.kind,
    p_entity_id: operation.entityId,
    p_version: operation.version,
    p_payload: toJson(operation.payload)
  });
  if (error) {
    throw new RepositoryError(
      "PERSISTENCE_UNAVAILABLE",
      "Unable to apply sync operation.",
      error
    );
  }
  return data;
}
