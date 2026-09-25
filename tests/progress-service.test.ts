// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createProgressService, type ProgressRepository } from "@/lib/progress/service";
import { createWordProgress } from "@/lib/storage";
import type { ProgressPlanDay, ProgressSessionDay } from "@/lib/progress/types";
import type { WordProgress } from "@/types/progress";

const ownerId = "00000000-0000-0000-0000-0000000000a1";

function stableWord(id: string): WordProgress {
  return {...createWordProgress(id), status: "review", firstLearnedAt: "2026-09-20T12:00:00Z",
    lastReviewedAt: "2026-09-22T12:00:00Z", nextReviewAt: "2026-10-01T12:00:00Z",
    correctCount: 2, memoryStrength: 60, lastRating: "good"};
}

function makeHarness(options: {
  timeZone?: string; firstPlanDate?: string | null; plans?: ProgressPlanDay[];
  sessions?: ProgressSessionDay[]; states?: Map<string, WordProgress>;
  passive?: Set<string>; readingCount?: number;
  failSnapshot?: boolean; failWordRead?: boolean;
  statesPromise?: Promise<Map<string, WordProgress>>;
} = {}) {
  const snapshots: Array<{learningDate: string; stableCount: number}> = [];
  const observations: string[] = [];
  const calls: Array<{method: string; userId: string}> = [];
  const forUser = (method: string, userId: string) => {
    calls.push({method, userId});
    if (userId !== ownerId) throw new Error("wrong account");
  };
  const repository: ProgressRepository = {
    async getProfileTimeZone(userId) {forUser("timezone", userId); return options.timeZone ?? "Asia/Shanghai";},
    async getFirstPlanDate(userId) {forUser("first-plan", userId); return options.firstPlanDate ?? null;},
    async getRecentPlanDays(userId) {forUser("recent-plans", userId); return options.plans ?? [];},
    async getStreakPlanDays(userId) {forUser("streak-plans", userId); return options.plans ?? [];},
    async getMatchingSessions(userId) {forUser("sessions", userId); return options.sessions ?? [];},
    async getWordStates(userId) {forUser("states", userId); if (options.failWordRead) throw new Error("source unavailable");
      const states = await (options.statesPromise ?? options.states ?? new Map());
      return {states, observedAt: new Date().toISOString()};},
    async getPassiveWordIds(userId) {forUser("passive", userId); return options.passive ?? new Set();},
    async getTrustedRootLinks() {return [{rootId: "spect-id", rootKey: "spect", wordId: "spectator"}];},
    async getSnapshots(userId) {forUser("snapshots", userId); return snapshots;},
    async upsertSnapshot(userId, learningDate, stableCount, _catalogVersion, observedAt) {
      forUser("upsert", userId);
      observations.push(observedAt);
      if (options.failSnapshot) throw new Error("local snapshot store unavailable");
      const index = snapshots.findIndex((snapshot) => snapshot.learningDate === learningDate);
      if (index >= 0) snapshots[index] = {learningDate, stableCount};
      else snapshots.push({learningDate, stableCount});
    },
    async countCompletedReadingPractice(userId) {forUser("reading", userId); return options.readingCount ?? 0;}
  };
  const service = createProgressService({repository,
    getCatalog: async () => ({ids: new Set(["spectator", "adapt"]), version: "2026.09.production-v2"})});
  return {service, repository, calls, snapshots, observations};
}

describe("Progress dashboard service", () => {
  it("uses a Shanghai local date across UTC midnight and the frozen plan denominator", async () => {
    const frozen: ProgressPlanDay = {id: "plan-26", learningDate: "2026-09-26", generationVersion: 1,
      status: "active", completedAt: null, requiredTargetIds: ["spectator", "adapt"], degradationReason: "词库不足"};
    const harness = makeHarness({firstPlanDate: "2026-09-26", plans: [frozen],
      sessions: [{planId: frozen.id, status: "active", completedTargetIds: ["spectator"]}]});
    const dashboard = await harness.service.getDashboard(ownerId, new Date("2026-09-25T16:30:00Z"));
    expect(dashboard.today).toMatchObject({date: "2026-09-26", state: "active", completed: 1,
      required: 2, degradationReason: "词库不足"});
    expect(dashboard.last7).toMatchObject({completed: 0, eligible: 1, percent: 0});
    expect(harness.snapshots).toEqual([{learningDate: "2026-09-26", stableCount: 0}]);
    expect(harness.calls.filter((call) => call.method !== "snapshots").every((call) => call.userId === ownerId))
      .toBe(true);
  });

  it("respects the New York DST transition instead of using UTC day keys", async () => {
    const harness = makeHarness({timeZone: "America/New_York"});
    const before = await harness.service.getDashboard(ownerId, new Date("2026-03-08T04:30:00Z"));
    const after = await harness.service.getDashboard(ownerId, new Date("2026-03-08T07:30:00Z"));
    expect(before.today.date).toBe("2026-03-07");
    expect(after.today.date).toBe("2026-03-08");
  });

  it("does not fabricate completion history for a new account or count Reading as Today", async () => {
    const harness = makeHarness({readingCount: 3, passive: new Set(["adapt"])});
    const dashboard = await harness.service.getDashboard(ownerId, new Date("2026-09-25T12:00:00Z"));
    expect(dashboard.today).toMatchObject({state: "not-started", completed: 0, required: 0});
    expect(dashboard.last7.percent).toBeNull();
    expect(dashboard.last30.percent).toBeNull();
    expect(dashboard.streak).toBe(0);
    expect(dashboard.vocabulary).toMatchObject({touched: 1, learning: 0, stable: 0});
    expect(dashboard.reading).toEqual({completedPracticeSessions7d: 3});
  });

  it("counts stable Support Word and its verified root but keeps passive Reading touched", async () => {
    const harness = makeHarness({states: new Map([["spectator", stableWord("spectator")]]),
      passive: new Set(["adapt"])});
    const dashboard = await harness.service.getDashboard(ownerId, new Date("2026-09-25T12:00:00Z"));
    expect(dashboard.vocabulary).toMatchObject({touched: 1, learning: 0, stable: 1, stablePercent: 0});
    expect(dashboard.roots).toEqual([expect.objectContaining({rootKey: "spect", usable: 1, stable: 1, percent: 100})]);
    expect(dashboard.growth).toMatchObject({available: true, hasTrend: false,
      points: [{date: "2026-09-25", stable: 1}]});
  });

  it("degrades only growth when its idempotent snapshot upsert fails", async () => {
    const harness = makeHarness({states: new Map([["spectator", stableWord("spectator")]]), failSnapshot: true});
    const dashboard = await harness.service.getDashboard(ownerId, new Date("2026-09-25T16:30:00Z"));
    expect(dashboard.today.date).toBe("2026-09-26");
    expect(dashboard.growth).toEqual({available: false, points: [], hasTrend: false, firstObservedDate: null});
    expect(dashboard.vocabulary.stable).toBe(1);
    expect(dashboard.roots[0].stable).toBe(1);
  });

  it("orders snapshots by when word states were observed, not when a request began", async () => {
    vi.useFakeTimers();
    try {
      const startedAt = new Date("2026-09-25T12:00:00.000Z");
      const observedAt = new Date("2026-09-25T12:01:00.000Z");
      vi.setSystemTime(startedAt);
      let release!: (states: Map<string, WordProgress>) => void;
      const statesPromise = new Promise<Map<string, WordProgress>>((resolve) => {release = resolve;});
      const harness = makeHarness({statesPromise});
      const pending = harness.service.getDashboard(ownerId, startedAt);
      vi.setSystemTime(observedAt);
      release(new Map([["spectator", stableWord("spectator")]]));
      await pending;
      expect(harness.observations).toEqual([observedAt.toISOString()]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a newer post-review observation when two requests resolve out of start order", async () => {
    vi.useFakeTimers();
    try {
      let resolveFirst!: (states: Map<string, WordProgress>) => void;
      let resolveSecond!: (states: Map<string, WordProgress>) => void;
      const firstRead = new Promise<Map<string, WordProgress>>((resolve) => {resolveFirst = resolve;});
      const secondRead = new Promise<Map<string, WordProgress>>((resolve) => {resolveSecond = resolve;});
      const harness = makeHarness();
      let readNumber = 0;
      let persisted: {count: number; observedAt: string} | null = null;
      harness.repository.getWordStates = async () => ({
        states: await (++readNumber === 1 ? firstRead : secondRead), observedAt: new Date().toISOString()
      });
      harness.repository.upsertSnapshot = async (_userId, _date, count, _version, observedAt) => {
        if (!persisted || observedAt > persisted.observedAt) persisted = {count, observedAt};
      };
      vi.setSystemTime(new Date("2026-09-25T12:00:00Z"));
      const olderRequest = harness.service.getDashboard(ownerId, new Date());
      vi.setSystemTime(new Date("2026-09-25T12:00:30Z"));
      const laterRequest = harness.service.getDashboard(ownerId, new Date());
      vi.setSystemTime(new Date("2026-09-25T12:01:00Z"));
      resolveSecond(new Map());
      await laterRequest;
      vi.setSystemTime(new Date("2026-09-25T12:02:00Z"));
      resolveFirst(new Map([["spectator", stableWord("spectator")]]));
      await olderRequest;
      expect(persisted).toEqual({count: 1, observedAt: "2026-09-25T12:02:00.000Z"});
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces an authoritative word-state read failure instead of reporting zero vocabulary", async () => {
    const harness = makeHarness({failWordRead: true});
    await expect(harness.service.getDashboard(ownerId, new Date("2026-09-25T12:00:00Z")))
      .rejects.toThrow("source unavailable");
  });
});
