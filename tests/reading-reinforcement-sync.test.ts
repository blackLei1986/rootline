// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { applySyncOperation, WordStateRevisionConflictError } from "@/lib/sync/learning-sync";
import type { SyncOperation } from "@/types/sync";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

function operation(kind: SyncOperation["kind"]): SyncOperation {
  return {id: "old-snapshot", kind, entityId: "adapt", version: 1,
    createdAt: "2026-09-25T00:00:00Z", payload: {wordId: "adapt", readingRevision: 0}};
}

describe("Reading revision sync boundary", () => {
  it("routes word snapshots to the guarded RPC and preserves the distinct stale-conflict code", async () => {
    const calls: string[] = [];
    const client = {rpc: async (name: string) => {calls.push(name); return {data: null,
      error: {code: "P0001", message: "READING_REVISION_CONFLICT"}};}} as unknown as SupabaseClient<Database>;
    await expect(applySyncOperation(client, "owner", operation("word-state"))).rejects.toBeInstanceOf(WordStateRevisionConflictError);
    expect(calls).toEqual(["apply_guarded_word_state"]);
  });

  it("leaves unrelated operation kinds on the old invoker RPC", async () => {
    const calls: string[] = [];
    const client = {rpc: async (name: string) => {calls.push(name); return {data: true, error: null};}} as unknown as SupabaseClient<Database>;
    expect(await applySyncOperation(client, "owner", operation("learning-event"))).toBe(true);
    expect(calls).toEqual(["apply_sync_operation"]);
  });
});
