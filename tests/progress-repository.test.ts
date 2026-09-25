// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SupabaseProgressRepository } from "@/lib/repositories/supabase/progress-repository";
import { createWordProgress } from "@/lib/storage";
import type { DatabaseClient } from "@/lib/repositories/supabase/shared";
import { shiftLearningDate } from "@/lib/today/local-date";

type Query = {table: string; filters: Array<[string, string, unknown]>; orders: Array<[string, boolean]>;
  range: [number, number] | null; limit: number | null; selected: string};
type Reply = {data: unknown; error: null | {code?: string; message: string}; count?: number | null};

function fakeClient(resolve: (query: Query) => Reply, rpcResult: Reply = {data: [], error: null}) {
  const calls: Query[] = [];
  const rpcCalls: Array<{name: string; args: unknown}> = [];
  const client = {
    from(table: string) {
      const query: Query = {table, filters: [], orders: [], range: null, limit: null, selected: ""};
      calls.push(query);
      const builder = {
        select(value: string) {query.selected = value; return builder;},
        eq(column: string, value: unknown) {query.filters.push(["eq", column, value]); return builder;},
        gte(column: string, value: unknown) {query.filters.push(["gte", column, value]); return builder;},
        lte(column: string, value: unknown) {query.filters.push(["lte", column, value]); return builder;},
        in(column: string, value: unknown) {query.filters.push(["in", column, value]); return builder;},
        order(column: string, options?: {ascending?: boolean}) {query.orders.push([column, options?.ascending ?? true]); return builder;},
        range(from: number, to: number) {query.range = [from, to]; return builder;},
        limit(value: number) {query.limit = value; return builder;},
        maybeSingle() {return Promise.resolve(resolve(query));},
        upsert(value: unknown, options?: unknown) {
          query.filters.push(["upsert", "row", value]);
          query.filters.push(["upsert", "options", options]);
          return Promise.resolve(resolve(query));
        },
        then(onFulfilled: (value: Reply) => unknown, onRejected?: (reason: unknown) => unknown) {
          return Promise.resolve(resolve(query)).then(onFulfilled, onRejected);
        }
      };
      return builder;
    },
    rpc(name: string, args: unknown) {rpcCalls.push({name, args}); return Promise.resolve(rpcResult);}
  };
  return {client: client as unknown as DatabaseClient, calls, rpcCalls};
}

function hasFilter(query: Query, op: string, column: string, value: unknown): boolean {
  return query.filters.some(([actualOp, actualColumn, actualValue]) => actualOp === op && actualColumn === column
    && JSON.stringify(actualValue) === JSON.stringify(value));
}

describe("Supabase Progress repository", () => {
  const owner = "00000000-0000-0000-0000-0000000000a1";

  it("scopes profile, first plan, recent plans, sessions, snapshots, and Reading to one account", async () => {
    const fake = fakeClient((query) => {
      if (query.table === "profiles") return {data: {timezone: "Asia/Shanghai"}, error: null};
      if (query.table === "today_plans" && query.limit === 1) return {data: {learning_date: "2026-09-23"}, error: null};
      if (query.table === "today_plans") return {data: [{id: "plan-1", learning_date: "2026-09-25",
        generation_version: 2, status: "active", completed_at: null, degradation_reason: null,
        plan_snapshot: {dailyTargets: [{wordId: "adapt"}]}}], error: null};
      if (query.table === "today_sessions") return {data: [{plan_id: "plan-1", status: "active",
        outcomes: {completedTargetIds: ["adapt"]}}], error: null};
      if (query.table === "progress_vocabulary_snapshots") return {data: [{learning_date: "2026-09-25",
        stable_count: 4}], error: null};
      if (query.table === "reading_reinforcement_sessions") return {data: null, error: null, count: 2};
      return {data: [], error: null};
    });
    const repository = new SupabaseProgressRepository(fake.client);
    expect(await repository.getProfileTimeZone(owner)).toBe("Asia/Shanghai");
    expect(await repository.getFirstPlanDate(owner)).toBe("2026-09-23");
    expect(await repository.getRecentPlanDays(owner, "2026-09-19", "2026-09-25"))
      .toMatchObject([{id: "plan-1", generationVersion: 2, requiredTargetIds: ["adapt"]}]);
    expect(await repository.getMatchingSessions(owner, ["plan-1"]))
      .toEqual([{planId: "plan-1", status: "active", completedTargetIds: ["adapt"]}]);
    expect(await repository.getSnapshots(owner, "2026-09-01", "2026-09-25"))
      .toEqual([{learningDate: "2026-09-25", stableCount: 4}]);
    expect(await repository.countCompletedReadingPractice(owner, "2026-09-19", "2026-09-25"))
      .toBe(2);
    for (const call of fake.calls) expect(hasFilter(call, "eq", "user_id", owner)).toBe(true);
    const firstPlan = fake.calls.find((call) => call.table === "today_plans" && call.limit === 1)!;
    expect(firstPlan.orders).toContainEqual(["learning_date", true]);
    const reading = fake.calls.find((call) => call.table === "reading_reinforcement_sessions")!;
    expect(hasFilter(reading, "eq", "status", "complete")).toBe(true);
    expect(hasFilter(reading, "gte", "learning_date", "2026-09-19")).toBe(true);
    expect(hasFilter(reading, "lte", "learning_date", "2026-09-25")).toBe(true);
  });

  it("fetches word state row 1001 instead of stopping at the PostgREST first page", async () => {
    const firstPage = Array.from({length: 1_000}, (_, index) => ({word_id: `word-${index}`,
      state: createWordProgress(`word-${index}`)}));
    const fake = fakeClient((query) => ({data: query.range?.[0] === 0 ? firstPage :
      [{word_id: "word-1000", state: createWordProgress("word-1000")}], error: null}));
    const states = await new SupabaseProgressRepository(fake.client).getWordStates(owner);
    expect(states.size).toBe(1_001);
    expect(fake.calls.map((call) => call.range)).toEqual([[0, 999], [1000, 1999]]);
    expect(fake.calls.every((call) => hasFilter(call, "eq", "user_id", owner))).toBe(true);
  });

  it("continues historical plan pages through a 45-day streak and stops at the first missing date", async () => {
    const days = Array.from({length: 45}, (_, offset) => shiftLearningDate("2026-09-25", -offset));
    const fake = fakeClient((query) => {
      const from = String(query.filters.find((item) => item[0] === "gte")?.[2]);
      const to = String(query.filters.find((item) => item[0] === "lte")?.[2]);
      return {data: days.filter((date) => date >= from && date <= to).map((date) => ({
        id: `p-${date}`, learning_date: date, generation_version: 1, status: "complete",
        completed_at: `${date}T12:00:00Z`, degradation_reason: null,
        plan_snapshot: {dailyTargets: [{wordId: "adapt"}]}
      })), error: null};
    });
    const rows = await new SupabaseProgressRepository(fake.client).getStreakPlanDays(owner, "2026-09-25");
    expect(new Set(rows.map((row) => row.learningDate)).size).toBe(45);
    expect(fake.calls.filter((call) => call.table === "today_plans").length).toBeGreaterThanOrEqual(2);
    expect(fake.calls.every((call) => hasFilter(call, "eq", "user_id", owner))).toBe(true);
  });

  it("returns only approved verified links from the latest published Gold dataset", async () => {
    const fake = fakeClient((query) => {
      if (query.table === "morphology_datasets") return {data: {id: "gold-2", version: "v2"}, error: null};
      if (query.table === "morphology_roots") return {data: [{id: "spect-id", root_key: "spect"}], error: null};
      return {data: [
        {catalog_word_id: "inspect", confidence: "verified", review_status: "approved",
          word_morphology_segments: [{kind: "root", root_id: "spect-id"}, {kind: "root", root_id: "spect-id"}]},
        {catalog_word_id: "derived", confidence: "derived", review_status: "approved",
          word_morphology_segments: [{kind: "root", root_id: "spect-id"}]},
        {catalog_word_id: "pending", confidence: "verified", review_status: "pending",
          word_morphology_segments: [{kind: "root", root_id: "spect-id"}]}
      ], error: null};
    });
    const links = await new SupabaseProgressRepository(fake.client).getTrustedRootLinks();
    expect(links).toEqual([{rootId: "spect-id", rootKey: "spect", wordId: "inspect"}]);
    const records = fake.calls.find((call) => call.table === "word_morphology_records")!;
    expect(hasFilter(records, "eq", "review_status", "approved")).toBe(true);
    expect(hasFilter(records, "eq", "confidence", "verified")).toBe(true);
    expect(fake.calls.find((call) => call.table === "morphology_datasets")?.orders)
      .toContainEqual(["published_at", false]);
  });

  it("calls the user-filtered passive RPC and upserts only that owner's current-date row", async () => {
    const fake = fakeClient(() => ({data: null, error: null}),
      {data: [{word_id: "adapt"}, {word_id: "inspect"}], error: null});
    const repository = new SupabaseProgressRepository(fake.client);
    expect(await repository.getPassiveWordIds(owner)).toEqual(new Set(["adapt", "inspect"]));
    await repository.upsertSnapshot(owner, "2026-09-25", 4, "2026.09.production-v2");
    expect(fake.rpcCalls).toEqual([{name: "progress_passive_word_ids", args: {p_user_id: owner}}]);
    const snapshot = fake.calls.find((call) => call.table === "progress_vocabulary_snapshots")!;
    expect(snapshot.filters.find(([op, column]) => op === "upsert" && column === "row")?.[2])
      .toMatchObject({user_id: owner, learning_date: "2026-09-25",
        stable_count: 4, catalog_version: "2026.09.production-v2"});
    expect(hasFilter(snapshot, "upsert", "options", {onConflict: "user_id,learning_date"})).toBe(true);
  });
});
