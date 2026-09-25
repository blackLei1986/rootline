import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyReadingRecommendationResult } from "@/types/reading-recommendations";

const mocks = vi.hoisted(() => ({
  getOptionalViewer: vi.fn(),
  getForToday: vi.fn(),
  listActive: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({ getOptionalViewer: mocks.getOptionalViewer }));
vi.mock("@/lib/reading/server-recommendations", () => ({
  createProductionDailyReadingRecommendationsService: () => ({ getForToday: mocks.getForToday })
}));
vi.mock("@/lib/reading/reinforcement/server", () => ({listActiveReadingReinforcementSessions: mocks.listActive}));

import ReadingPage from "@/app/reading/page";

const emptyResult: DailyReadingRecommendationResult = {
  algorithmVersion: "daily-3-v1", generatedAt: "2026-09-24T12:00:00.000Z", recommendations: []
};

describe("Daily-3 Reading home", () => {
  beforeEach(() => {
    mocks.getOptionalViewer.mockReset();
    mocks.getForToday.mockReset();
    mocks.listActive.mockReset().mockResolvedValue([]);
  });

  afterEach(() => cleanup());

  it("uses the verified viewer's frozen recommendation service, not the legacy candidate feed", async () => {
    mocks.getOptionalViewer.mockResolvedValue({ userId: "reader-1", email: "reader@example.test", emailVerified: true });
    mocks.getForToday.mockResolvedValue(emptyResult);

    render(await ReadingPage());

    expect(mocks.getForToday).toHaveBeenCalledWith("reader-1");
    expect(screen.getByRole("heading", { name: "今日阅读" })).toBeVisible();
    expect(screen.getByText("今天还没有可推荐的短文。" )).toBeVisible();
    expect(screen.queryByRole("link", { name: "导入" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "订阅源" })).not.toBeInTheDocument();
    expect(screen.queryByText(/添加少量高质量来源/)).not.toBeInTheDocument();
  });

  it("routes signed-out or unverified viewers through verified access and does not load recommendations", async () => {
    mocks.getOptionalViewer.mockResolvedValue({ userId: "reader-1", email: "reader@example.test", emailVerified: false });

    render(await ReadingPage());

    expect(screen.getByRole("link", { name: /登录/ })).toHaveAttribute("href", "/login?next=%2Freading");
    expect(mocks.getForToday).not.toHaveBeenCalled();
  });

  it("shows no more than three persisted recommendations and isolates a service failure", async () => {
    const rec = (articleId: string) => ({ articleId, title: `Title ${articleId}`, sourceTitle: "Publisher", attribution: "Publisher", sourceKey: "source", canonicalUrl: "https://example.test", publisherUrl: "https://example.test", publishedAt: null, summary: null, scores: { todayMatches: 0, recentMatches: 0, difficultyFit: 0, freshness: 0, sourceQuality: 0, total: 0 }, matchedTodayWordIds: [], matchedRecentWordIds: [], estimatedUnknownCoverage: { percent: 20, approximate: true as const, basis: "tracked-vocabulary-match-occurrences" as const }, reasonCodes: [] });
    mocks.getOptionalViewer.mockResolvedValue({ userId: "reader-1", email: "reader@example.test", emailVerified: true });
    mocks.getForToday.mockResolvedValue({ ...emptyResult, recommendations: [rec("1"), rec("2"), rec("3"), rec("4")] });

    const list = render(await ReadingPage());
    expect(screen.getByRole("heading", { name: "Title 1" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Title 3" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Title 4" })).not.toBeInTheDocument();
    list.unmount();

    mocks.getForToday.mockRejectedValue(new Error("private failure detail"));
    render(await ReadingPage());
    expect(screen.getByText("阅读推荐暂时不可用，请稍后重试。" )).toBeVisible();
    expect(screen.queryByText("private failure detail")).not.toBeInTheDocument();
  });

  it("lists at most three active practice sessions separately from Daily-3", async () => {
    mocks.getOptionalViewer.mockResolvedValue({userId: "reader-1", email: "reader@example.test", emailVerified: true});
    mocks.getForToday.mockResolvedValue(emptyResult);
    mocks.listActive.mockResolvedValue(Array.from({length: 4}, (_, i) => ({id: `session-${i}`, practiced: i, total: 5})));
    render(await ReadingPage());
    expect(screen.getByRole("region", {name: "继续词汇巩固"})).toBeVisible();
    expect(screen.getAllByRole("link", {name: /继续练习/})).toHaveLength(3);
    expect(screen.queryByRole("link", {name: "继续练习 · 3/5 词"})).not.toBeInTheDocument();
  });
});
