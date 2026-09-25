import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOptionalViewer: vi.fn(),
  getOwnedSession: vi.fn(),
  notFound: vi.fn(() => {throw new Error("NEXT_NOT_FOUND");}),
  redirect: vi.fn((path: string) => {throw new Error(`NEXT_REDIRECT:${path}`);})
}));
vi.mock("@/lib/auth/session", () => ({getOptionalViewer: mocks.getOptionalViewer}));
vi.mock("@/lib/reading/reinforcement/server", () => ({
  createProductionReadingReinforcementService: () => ({getOwnedSession: mocks.getOwnedSession})
}));
vi.mock("next/navigation", () => ({notFound: mocks.notFound, redirect: mocks.redirect}));

import ReadingReinforcementPage from "@/app/reading/reinforcement/[sessionId]/page";

describe("owned reading reinforcement page", () => {
  beforeEach(() => {vi.clearAllMocks();});
  afterEach(() => cleanup());

  it("redirects unverified viewers and hides foreign sessions", async () => {
    mocks.getOptionalViewer.mockResolvedValueOnce(null).mockResolvedValueOnce({userId: "owner", emailVerified: true});
    await expect(ReadingReinforcementPage({params: Promise.resolve({sessionId: "private"})}))
      .rejects.toThrow("NEXT_REDIRECT:/login?next=%2Freading%2Freinforcement%2Fprivate");
    expect(mocks.getOwnedSession).not.toHaveBeenCalled();
    mocks.getOwnedSession.mockResolvedValue(null);
    await expect(ReadingReinforcementPage({params: Promise.resolve({sessionId: "foreign"})})).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getOwnedSession).toHaveBeenCalledWith("owner", "foreign");
  });

  it("renders the public persisted session", async () => {
    mocks.getOptionalViewer.mockResolvedValue({userId: "owner", emailVerified: true});
    mocks.getOwnedSession.mockResolvedValue({id: "session-1", articleId: "article-1", articleLabel: "文章语境词汇",
      learningDate: "2026-09-25", status: "complete", cursor: 1, total: 1, practiced: 1, correct: 1,
      currentQuestion: null, outcomes: []});
    render(await ReadingReinforcementPage({params: Promise.resolve({sessionId: "session-1"})}));
    expect(screen.getByRole("heading", {name: "阅读词汇巩固"})).toBeVisible();
    expect(screen.getByRole("heading", {name: "已完成 1 个词"})).toBeVisible();
  });
});
