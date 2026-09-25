import { describe, expect, it } from "vitest";
import { createOwnedWordStateGetHandler } from "@/lib/sync/word-state-http";
import { createWordProgress } from "@/lib/storage";
import type { ViewerDTO } from "@/types/auth";

describe("authoritative word-state read boundary", () => {
  it("returns only the verified owner's state and hides a missing word", async () => {
    const viewer = {userId: "owner", email: "owner@example.org", emailVerified: true} as ViewerDTO;
    const handler = createOwnedWordStateGetHandler({requireViewer: async () => viewer,
      getWordState: async (userId, wordId) => userId === "owner" && wordId === "adapt"
        ? {...createWordProgress("adapt"), readingRevision: 2} : null});
    const own = await handler(new Request("http://local/word"), {params: Promise.resolve({wordId: "adapt"})});
    expect(own.status).toBe(200);
    expect((await own.json()).wordState.readingRevision).toBe(2);
    expect((await handler(new Request("http://local/word"), {params: Promise.resolve({wordId: "other"})})).status).toBe(404);
  });
});
