// @vitest-environment node

import { describe, expect, it } from "vitest";
import { SupabaseReadingReinforcementRepository } from "@/lib/repositories/supabase/reading-reinforcement-repository";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createWordProgress } from "@/lib/storage";

describe("reading reinforcement repository", () => {
  it("sends one server-derived answer to the atomic RPC", async () => {
    const calls: Array<{name: string; args: Record<string, unknown>}> = [];
    const client = {rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({name, args});
      return {data: {kind: "conflict"}, error: null};
    }} as unknown as SupabaseClient<Database>;
    const repository = new SupabaseReadingReinforcementRepository(client);

    const result = await repository.commitAnswer({
      userId: "00000000-0000-0000-0000-000000000001",
      sessionId: "00000000-0000-0000-0000-000000000099",
      questionId: "q1", expectedSessionRevision: 0, wordId: "adapt",
      expectedReadingRevision: 0, eventId: "reading-answer:session:q1",
      submittedAnswer: "adapt", correct: true, eventType: "quiz_correct",
      eventPayload: {mode: "reading-recall"}, nextWordState: {...createWordProgress("adapt"), readingRevision: 1}
    });

    expect(result.kind).toBe("conflict");
    expect(calls).toEqual([{name: "apply_reading_answer", args: expect.objectContaining({
      p_user_id: "00000000-0000-0000-0000-000000000001",
      p_question_id: "q1", p_expected_reading_revision: 0,
      p_event_id: "reading-answer:session:q1", p_correct: true
    })}]);
  });
});
