import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DailyReadingCard } from "@/components/reading/daily-reading-card";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";

function recommendation(overrides: Partial<DailyReadingRecommendation> = {}): DailyReadingRecommendation {
  return {
    articleId: "article-1", title: "A science story", canonicalUrl: "https://example.test/story",
    publisherUrl: "https://example.test/story", sourceKey: "science", sourceTitle: "Science Desk",
    attribution: "NASA", publishedAt: "2026-09-23T12:00:00.000Z", summary: "One two three four five.",
    scores: { todayMatches: 0, recentMatches: 0, difficultyFit: 0, freshness: 0, sourceQuality: 0, total: 0 },
    matchedTodayWordIds: ["today-1", "today-2"], matchedRecentWordIds: ["recent-1"],
    estimatedUnknownCoverage: { percent: 9.9, approximate: true, basis: "tracked-vocabulary-match-occurrences" },
    reasonCodes: [], ...overrides
  };
}

describe("Daily-3 reading cards", () => {
  afterEach(() => cleanup());

  it("shows frozen metadata, match counts, summary-only time, difficulty and the Daily-3 link", () => {
    render(<DailyReadingCard recommendation={recommendation()} />);

    expect(screen.getByRole("heading", { name: "A science story" })).toBeVisible();
    expect(screen.getByText("Science Desk")).toBeVisible();
    expect(screen.getByText("NASA")).toBeVisible();
    expect(screen.getByText((_, element) => element?.tagName === "SPAN" && element.textContent?.includes("Today 命中 2 词") === true)).toBeVisible();
    expect(screen.getByText((_, element) => element?.tagName === "SPAN" && element.textContent?.includes("近期词 1 词") === true)).toBeVisible();
    expect(screen.getByText("较容易")).toBeVisible();
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent?.includes("摘要约 1 分钟") === true)).toBeVisible();
    expect(screen.getByRole("link", { name: /开始阅读/ })).toHaveAttribute("href", "/reading/daily/article-1");
  });

  it("labels a new seven-day subset differently from a legacy 30-day-only snapshot", () => {
    const { rerender } = render(<DailyReadingCard recommendation={recommendation({ matchedRecent7DayWordIds: ["recent-1"] })} />);
    expect(screen.getByText((_, element) => element?.tagName === "SPAN" && element.textContent?.includes("近 7 日词 1 词") === true)).toBeVisible();
    expect(screen.queryByText((_, element) => element?.tagName === "SPAN" && element.textContent?.includes("近期词 1 词") === true)).not.toBeInTheDocument();

    rerender(<DailyReadingCard recommendation={recommendation()} />);
    expect(screen.getByText((_, element) => element?.tagName === "SPAN" && element.textContent?.includes("近期词 1 词") === true)).toBeVisible();
    expect(screen.queryByText((_, element) => element?.tagName === "SPAN" && element.textContent?.includes("近 7 日词 1 词") === true)).not.toBeInTheDocument();
  });

  it.each([
    [9.99, "较容易"], [10, "适中"], [24.99, "适中"], [25, "有挑战"]
  ])("uses fixed difficulty buckets for %s percent", (percent, label) => {
    render(<DailyReadingCard recommendation={recommendation({ estimatedUnknownCoverage: { percent, approximate: true, basis: "tracked-vocabulary-match-occurrences" } })} />);
    expect(screen.getByText(label)).toBeVisible();
  });

  it("omits estimated time and explains when no summary is available", () => {
    render(<DailyReadingCard recommendation={recommendation({ summary: null })} />);
    expect(screen.queryByText((_, element) => element?.tagName === "P" && element.textContent?.includes("摘要约") === true)).not.toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent?.includes("暂无摘要，可前往发布方阅读原文。") === true)).toBeVisible();
  });
});
