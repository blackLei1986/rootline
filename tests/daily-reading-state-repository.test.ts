// @vitest-environment node

import { describe, expect, it } from "vitest";
import { SupabaseDailyReadingArticleRepository } from "@/lib/repositories/supabase/daily-reading-article-repository";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

interface RecordedCall {
  table: string;
  operation: string;
  payload?: Record<string, unknown>;
  options?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
}

const initialState = { opened_at: "2026-09-24T11:00:00.000Z", completed_at: null };

function makeRepository(storedState: { opened_at: string | null; completed_at: string | null } | null = initialState) {
  const calls: RecordedCall[] = [];
  const client = {
    from(table: string) {
      const call: RecordedCall = { table, operation: "", filters: [] };
      let activeCall = call;
      const query = {
        select(columns: string) {
          activeCall.operation = "select";
          activeCall.payload = { columns };
          calls.push(activeCall);
          return query;
        },
        eq(column: string, value: unknown) { activeCall.filters.push([column, value]); return query; },
        is(column: string, value: unknown) {
          activeCall.filters.push([column, value]);
          return Promise.resolve({ error: null });
        },
        maybeSingle: async () => ({ data: storedState, error: null }),
        upsert(payload: Record<string, unknown>, options: Record<string, unknown>) {
          calls.push({ ...activeCall, operation: "upsert", payload, options, filters: [...activeCall.filters] });
          return Promise.resolve({ error: null });
        },
        update(payload: Record<string, unknown>) {
          activeCall = { ...call, operation: "update", payload, filters: [] };
          calls.push(activeCall);
          return query;
        }
      };
      return query;
    }
  } as unknown as SupabaseClient<Database>;
  return { repository: new SupabaseDailyReadingArticleRepository(client), calls };
}

describe("Daily-3 article read-state repository", () => {
  it("reads only timestamps with both owner and article filters", async () => {
    const { repository, calls } = makeRepository();

    await expect(repository.getState("owner-1", "article-1")).resolves.toEqual({
      openedAt: "2026-09-24T11:00:00.000Z", completedAt: null
    });
    expect(calls[0]).toMatchObject({
      table: "user_article_states", operation: "select", payload: { columns: "opened_at,completed_at" },
      filters: [["user_id", "owner-1"], ["article_id", "article-1"]]
    });
  });

  it("uses conflict-ignore plus conditional timestamp-only updates", async () => {
    const { repository, calls } = makeRepository({ opened_at: null, completed_at: null });

    await repository.updateState("owner-1", "article-1", { opened: true, completed: true });

    const upsert = calls.find((call) => call.operation === "upsert");
    expect(upsert?.options).toEqual({ onConflict: "user_id,article_id", ignoreDuplicates: true });
    expect(Object.keys(upsert?.payload ?? {}).sort()).toEqual(["article_id", "completed_at", "opened_at", "user_id"]);
    const updates = calls.filter((call) => call.operation === "update");
    expect(updates.map((call) => Object.keys(call.payload ?? {}))).toEqual([["opened_at"], ["completed_at"]]);
    expect(updates[0]?.filters).toEqual([["user_id", "owner-1"], ["article_id", "article-1"], ["opened_at", null]]);
    expect(updates[1]?.filters).toEqual([["user_id", "owner-1"], ["article_id", "article-1"], ["completed_at", null]]);
  });

  it("does not update completion when the request only marks an article opened", async () => {
    const { repository, calls } = makeRepository(initialState);

    await repository.updateState("owner-1", "article-1", { opened: true });

    const upsert = calls.find((call) => call.operation === "upsert");
    expect(upsert?.payload).not.toHaveProperty("completed_at");
    const updates = calls.filter((call) => call.operation === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0]?.payload).toEqual({ opened_at: expect.any(String) });
    expect(updates[0]?.filters.at(-1)).toEqual(["opened_at", null]);
  });

  it("returns null when no state row exists", async () => {
    const { repository } = makeRepository(null);

    await expect(repository.getState("owner-1", "article-1")).resolves.toBeNull();
  });
});
