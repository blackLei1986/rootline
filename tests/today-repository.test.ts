import { describe, expect, it } from "vitest";
import { SupabaseTodayRepository } from "@/lib/repositories/supabase/today-repository";
import type { DatabaseClient } from "@/lib/repositories/supabase/shared";

describe("SupabaseTodayRepository", () => {
  it("restores Daily 30 block, target activities, and review state from persisted rows", async () => {
    const repository = new SupabaseTodayRepository(client({
      today_sessions: {
        status: "active",
        current_stage: "learn",
        current_block: 2,
        outcomes: {
          completedQuestionIds: [],
          completedTargetIds: ["target-1"],
          completedMiniReviewBlocks: [1],
          finalReviewComplete: false,
          reviewAccuracy: { correct: 2, total: 3 }
        }
      },
      today_target_progress: [{
        target_id: "target-1", block: 1, status: "complete", current_activity: null,
        recognition_state: "fuzzy", outcomes: { association: true, cloze: false, recall: true }
      }]
    }));

    await expect(repository.getSession("owner", "plan")).resolves.toMatchObject({
      status: "active",
      currentStage: "learn",
      currentBlock: 2,
      completedTargetIds: ["target-1"],
      completedMiniReviewBlocks: [1],
      finalReviewComplete: false,
      reviewAccuracy: { correct: 2, total: 3 },
      targetProgress: {
        "target-1": {
          targetId: "target-1", block: 1, status: "complete", currentActivity: null,
          recognitionState: "fuzzy", outcomes: { association: true, cloze: false, recall: true }
        }
      }
    });
  });
});

function client(rows: Record<string, unknown>): DatabaseClient {
  return {
    from(table: string) {
      const query = {
        select() { return query; },
        eq() { return query; },
        order() { return query; },
        limit() { return query; },
        async maybeSingle() { return { data: rows[table] ?? null, error: null }; },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve);
        }
      };
      return query;
    }
  } as unknown as DatabaseClient;
}
