import { describe, expect, it, vi } from "vitest";
import { createDailyReadingArticleStatePostHandler } from "@/lib/reading/daily-reading-article-state-http";
import type { ViewerDTO } from "@/types/auth";

const viewer = { userId: "verified-owner", email: "owner@example.test", emailVerified: true };
const savedState = { openedAt: "2026-09-24T11:00:00.000Z", completedAt: "2026-09-24T12:00:00.000Z" };

function makeHandler(overrides: {
  requireViewer?: () => Promise<ViewerDTO | Response>;
  updateState?: (userId: string, articleId: string, patch: { opened?: true; completed?: true }) => Promise<typeof savedState | null>;
} = {}) {
  const updateState = overrides.updateState ?? vi.fn(async () => savedState);
  const handler = createDailyReadingArticleStatePostHandler({
    requireViewer: overrides.requireViewer ?? (async () => viewer),
    service: { updateState }
  });
  return { handler, updateState };
}

function post(body: string, id = "article-1") {
  return new Request(`https://rootline.test/api/reading/articles/${id}/state`, {
    method: "POST", headers: { "content-type": "application/json" }, body
  });
}

describe("Daily-3 article state HTTP boundary", () => {
  it("rejects an unverified viewer before updating state", async () => {
    const unauthorized = Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    const { handler, updateState } = makeHandler({ requireViewer: async () => unauthorized });

    const response = await handler(post('{"opened":true}'), { params: Promise.resolve({ id: "article-1" }) });

    expect(response).toBe(unauthorized);
    expect(updateState).not.toHaveBeenCalled();
  });

  it.each(["{}", "{\"opened\":false}", "{\"saved\":true}", "{\"completed\":true,\"userId\":\"attacker\"}", "not-json"])(
    "returns 400 for a malformed, empty, or out-of-scope body: %s",
    async (body) => {
      const { handler, updateState } = makeHandler();
      const response = await handler(post(body), { params: Promise.resolve({ id: "article-1" }) });

      expect(response.status).toBe(400);
      expect(updateState).not.toHaveBeenCalled();
    }
  );

  it("uses the verified user ID and article route param, ignoring body ownership data", async () => {
    const updateState = vi.fn(async () => savedState);
    const { handler } = makeHandler({ updateState });

    const response = await handler(post('{"completed":true}', "article-2"), { params: Promise.resolve({ id: "article-2" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, state: savedState });
    expect(updateState).toHaveBeenCalledWith("verified-owner", "article-2", { completed: true });
  });

  it("returns a generic 404 for an article outside the current frozen set", async () => {
    const { handler } = makeHandler({ updateState: async () => null });

    const response = await handler(post('{"opened":true}'), { params: Promise.resolve({ id: "not-in-daily-3" }) });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "READING_ARTICLE_NOT_AVAILABLE" });
  });

  it("does not leak database errors", async () => {
    const { handler } = makeHandler({ updateState: async () => { throw new Error("private database detail"); } });

    const response = await handler(post('{"completed":true}'), { params: Promise.resolve({ id: "article-1" }) });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "READING_ARTICLE_STATE_UNAVAILABLE" });
  });
});
