import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearBetaEvidenceOutbox, enqueueBetaEvidence, flushBetaEvidence } from "@/lib/beta/evidence-outbox";

describe("Beta evidence outbox", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("keeps every event in a separate account-scoped key until server acknowledgement", async () => {
    enqueueBetaEvidence("user-a", "2026-10-04", { type: "today-open" }, "event:550e8400-e29b-41d4-a716-446655440001");
    enqueueBetaEvidence("user-a", "2026-10-04", { type: "progress-open" }, "event:550e8400-e29b-41d4-a716-446655440002");
    enqueueBetaEvidence("user-b", "2026-10-04", { type: "journal", ratings: { difficulty: 3, fatigue: 2, rootUsefulness: 4, reviewUsefulness: 4 }, continueTomorrow: true, note: "private" }, "event:550e8400-e29b-41d4-a716-446655440003");
    const sent: unknown[] = [];
    await flushBetaEvidence("user-a", async (record) => { sent.push(record); return true; });
    expect(sent).toHaveLength(2);
    expect(JSON.stringify(sent)).not.toContain("user-b");
    expect(Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))).toEqual(expect.arrayContaining([expect.stringContaining("user-b")]));
  });

  it("does not overwrite a deterministic Today event or discard a failed upload", async () => {
    enqueueBetaEvidence("user-a", "2026-10-04", { type: "session-started" }, "today:2026-10-04:7");
    enqueueBetaEvidence("user-a", "2026-10-04", { type: "session-completed" }, "today:2026-10-04:7");
    const sent: unknown[] = [];
    await flushBetaEvidence("user-a", async (record) => { sent.push(record); return false; });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ event: { type: "session-started" } });
    expect(localStorage.length).toBe(1);
    await flushBetaEvidence("user-a", async () => true);
    expect(localStorage.length).toBe(0);
  });

  it("exports only a reading token to the server and clears only the chosen account's queue", async () => {
    enqueueBetaEvidence("user-a", "2026-10-04", { type: "reading-completed", sessionId: "private-reading-id" }, "event:550e8400-e29b-41d4-a716-446655440004");
    enqueueBetaEvidence("user-b", "2026-10-04", { type: "today-open" }, "event:550e8400-e29b-41d4-a716-446655440005");
    const sent: unknown[] = [];
    await flushBetaEvidence("user-a", async (record) => { sent.push(record); return false; });
    expect(JSON.stringify(sent)).not.toContain("private-reading-id");
    expect(sent[0]).toMatchObject({ event: { type: "reading-completed", sessionToken: expect.stringMatching(/^[0-9a-f]{16}$/) } });
    clearBetaEvidenceOutbox("user-a");
    expect(localStorage.length).toBe(1);
  });

  it("retries observed Reading before its completion even when event keys sort in reverse", async () => {
    enqueueBetaEvidence("user-a", "2026-10-04", { type: "reading-observed", sessionId: "session-1" }, "event:ffffffff-ffff-4fff-8fff-ffffffffffff");
    enqueueBetaEvidence("user-a", "2026-10-04", { type: "reading-completed", sessionId: "session-1" }, "event:00000000-0000-4000-8000-000000000000");
    const types: string[] = [];
    await flushBetaEvidence("user-a", async (record) => { types.push(record.event.type); return true; });
    expect(types).toEqual(["reading-observed", "reading-completed"]);
  });
});
