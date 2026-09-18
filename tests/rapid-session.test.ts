import { describe, expect, it } from "vitest";
import { classifyRapidWord, createRapidSession } from "@/lib/rapid-session";
import { EMPTY_STORAGE } from "@/lib/storage";

describe("rapid session", () => {
  it("routes known, fuzzy and unknown words without adding known to deep learning", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    let session = createRapidSession(storage, 20, 20, new Date("2026-09-17T00:00:00.000Z"));
    session = { ...session, wordIds: session.wordIds.slice(0, 3) };
    const [knownId, fuzzyId, unknownId] = session.wordIds;
    session = classifyRapidWord(session, storage, "known", 1200, false, () => 0.1);
    session = classifyRapidWord(session, storage, "fuzzy", 1800, true, () => 0.9);
    session = classifyRapidWord(session, storage, "unknown", 2200, true, () => 0.9);
    expect(session.scanIndex).toBe(3);
    expect(session.learningQueue.map((item) => item.wordId)).not.toContain(knownId);
    expect(session.learningQueue.map((item) => item.wordId)).toEqual(expect.arrayContaining([fuzzyId, unknownId]));
    expect(session.verificationWordIds).toContain(knownId);
    expect(session.phase).toBe("learn");
  });

  it("retains position and classifications through serialization", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    let session = createRapidSession(storage, 50, 20, new Date("2026-09-17T00:00:00.000Z"));
    session = classifyRapidWord(session, storage, "known", 900, false, () => 0.9);
    const restored = JSON.parse(JSON.stringify(session));
    expect(restored.scanIndex).toBe(1);
    expect(Object.keys(restored.recognitionResults)).toHaveLength(1);
    expect(restored.wordIds).toHaveLength(50);
  });
});
