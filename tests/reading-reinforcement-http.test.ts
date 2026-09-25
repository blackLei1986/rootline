import { describe, expect, it } from "vitest";
import { createReadingEvidencePostHandler } from "@/lib/reading/reinforcement/http";
import type { ViewerDTO } from "@/types/auth";

const viewer = {userId: "owner", email: "owner@example.org", emailVerified: true} as ViewerDTO;
const context = {params: Promise.resolve({id: "article-1"})};

describe("Reading evidence HTTP boundary", () => {
  it("requires authentication and rejects extra authority fields", async () => {
    const signedOut = createReadingEvidencePostHandler({requireViewer: async () => Response.json({}, {status: 401}),
      getService: () => ({recordReadingEvidence: async () => ({saved: true})})});
    expect((await signedOut(new Request("http://local/evidence", {method: "POST", body: JSON.stringify({action: "exposure", wordId: "adapt"})}), context)).status).toBe(401);
    const handler = createReadingEvidencePostHandler({requireViewer: async () => viewer,
      getService: () => ({recordReadingEvidence: async () => ({saved: true})})});
    expect((await handler(new Request("http://local/evidence", {method: "POST", body: JSON.stringify({action: "exposure", wordId: "adapt", userId: "other"})}), context)).status).toBe(400);
  });

  it("returns 404 for unavailable words and retryable 503 when persistence fails", async () => {
    const missing = createReadingEvidencePostHandler({requireViewer: async () => viewer,
      getService: () => ({recordReadingEvidence: async () => null})});
    const request = () => new Request("http://local/evidence", {method: "POST", body: JSON.stringify({action: "detail-open", wordId: "adapt"})});
    expect((await missing(request(), context)).status).toBe(404);
    const failed = createReadingEvidencePostHandler({requireViewer: async () => viewer,
      getService: () => ({recordReadingEvidence: async () => {throw new Error("offline");}})});
    expect((await failed(request(), context)).status).toBe(503);
  });
});
