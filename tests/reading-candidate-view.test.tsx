import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ForYou } from "@/components/reading/for-you";
import type { ArticleCandidate } from "@/types/articles";

describe("Reading candidate view", () => {
  it("renders at most three candidates with learning-fit details", () => {
    render(<ForYou authenticated candidates={Array.from({ length: 4 }, (_, index) => candidate(index))} />);
    expect(screen.getAllByTestId("article-candidate")).toHaveLength(3);
    expect(screen.getAllByText(/6 分钟/)).toHaveLength(3);
    expect(screen.getAllByText(/96% 覆盖/)).toHaveLength(3);
    expect(screen.getAllByText(/7 个高价值新词/)).toHaveLength(3);
    expect(screen.getAllByText("Example Source")).toHaveLength(3);
    expect(screen.getAllByText("覆盖度适合巩固与拓展")).toHaveLength(3);
  });

  it("offers login, sources, and import paths without a backlog count", () => {
    const { rerender } = render(<ForYou authenticated={false} candidates={[]} />);
    expect(screen.getByRole("link", { name: "登录后获取推荐" })).toHaveAttribute(
      "href",
      "/login?next=%2Freading"
    );
    rerender(<ForYou authenticated candidates={[]} />);
    expect(screen.getByRole("link", { name: "管理订阅源" })).toHaveAttribute("href", "/reading/sources");
    expect(screen.getByRole("link", { name: "导入文章" })).toHaveAttribute("href", "/reading/import");
    expect(screen.queryByText(/未读/)).not.toBeInTheDocument();
  });
});

function candidate(index: number): ArticleCandidate {
  return {
    articleId: `article-${index}`,
    title: `Article ${index}`,
    sourceTitle: "Example Source",
    canonicalUrl: `https://example.com/${index}`,
    estimatedMinutes: 6,
    contentWordCoverage: 96,
    valuableUnknownWordIds: Array.from({ length: 7 }, (_, word) => `word-${word}`),
    score: 90 - index,
    explanationCodes: ["coverage-fit"]
  };
}
