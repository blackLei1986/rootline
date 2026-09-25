import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DailyReadingArticle } from "@/components/reading/daily-reading-article";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";
import type { DailyTargetSnapshot } from "@/types/today";

const mocks = vi.hoisted(() => ({
  getOptionalViewer: vi.fn(),
  loadDailyReadingArticlePageData: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
  redirect: vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); }),
  routerPush: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({ getOptionalViewer: mocks.getOptionalViewer }));
vi.mock("@/lib/reading/server-daily-reading-article-page", () => ({ loadDailyReadingArticlePageData: mocks.loadDailyReadingArticlePageData }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect, useRouter: () => ({push: mocks.routerPush}) }));

import DailyReadingArticlePage from "@/app/reading/daily/[id]/page";

const article: DailyReadingRecommendation = {
  articleId: "article-1", title: "A science story", canonicalUrl: "https://example.test/story",
  publisherUrl: "https://publisher.test/story", sourceKey: "science", sourceTitle: "Science Desk", attribution: "NASA",
  publishedAt: "2026-09-23T12:00:00.000Z", summary: "Adapt, then learn.",
  scores: { todayMatches: 1, recentMatches: 1, difficultyFit: 0, freshness: 0, sourceQuality: 0, total: 0 },
  matchedTodayWordIds: ["adapt-id"], matchedRecentWordIds: ["learn-id"], matchedRecent7DayWordIds: ["learn-id"],
  estimatedUnknownCoverage: { percent: 12, approximate: true, basis: "tracked-vocabulary-match-occurrences" }, reasonCodes: []
};

const todayWord: DailyTargetSnapshot = {
  wordId: "adapt-id", word: "adapt", lemma: "adapt", coreMeaningZh: "适应", coreDefinitionEn: "adjust", phonetic: "əˈdæpt",
  partOfSpeech: ["verb"], example: "We adapt quickly.", examples: ["We adapt quickly."], source: "root-core", rootId: "root-1", rootForm: "apt",
  rootMeaningEn: ["fit"], rootMeaningZh: ["适合"], rootExplanation: "fit", familyId: "family-1",
  morphology: { segments: [{ kind: "root", surfaceForm: "apt", meaning: "fit" }], formationExplanation: "adapt means to fit to a new use" }, block: 1, position: 0
};
const words = [
  { ...todayWord, level: "today" as const },
  { wordId: "learn-id", word: "learn", lemma: "learn", coreMeaningZh: "学习", coreDefinitionEn: "gain knowledge", phonetic: "lɜːrn", example: "We learn together.", morphology: null, level: "recent-7-day" as const }
];
const summaryTokens = [
  { text: "Adapt", wordId: "adapt-id", level: "today" as const },
  { text: ", then " },
  { text: "learn", wordId: "learn-id", level: "recent-7-day" as const },
  { text: "." }
];

describe("Daily-3 article page and reader", () => {
  beforeEach(() => {
    mocks.getOptionalViewer.mockReset();
    mocks.loadDailyReadingArticlePageData.mockReset();
    mocks.notFound.mockClear();
    mocks.redirect.mockClear();
    mocks.routerPush.mockClear();
  });
  afterEach(() => cleanup());

  it("renders only the frozen summary and source attribution with a safe publisher link", () => {
    render(<DailyReadingArticle article={article} words={words} summaryTokens={summaryTokens} />);
    expect(screen.getByRole("heading", { name: "A science story" })).toBeVisible();
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "Adapt, then learn.")).toBeVisible();
    expect(screen.getByText("NASA")).toBeVisible();
    const publisher = screen.getByRole("link", { name: "前往发布方阅读原文" });
    expect(publisher).toHaveAttribute("href", "https://publisher.test/story");
    expect(publisher).toHaveAttribute("target", "_blank");
    expect(publisher).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByText(/extracted_text|全文正文/)).not.toBeInTheDocument();
  });

  it("shows a transparent no-summary fallback and never fabricates article text", () => {
    render(<DailyReadingArticle article={{ ...article, summary: null }} words={[]} summaryTokens={[]} />);
    expect(screen.getByText("发布方没有提供可展示的摘要。你仍可前往发布方阅读原文。" )).toBeVisible();
    expect(screen.queryByRole("article", { name: /摘要/ })).not.toBeInTheDocument();
  });

  it("opens keyboard-activatable accessible word details and only shows trusted morphology", async () => {
    render(<DailyReadingArticle article={article} words={words} summaryTokens={summaryTokens} />);
    const todayButton = screen.getByRole("button", { name: "Adapt，今日词" });
    todayButton.focus();
    fireEvent.keyDown(todayButton, { key: "Enter" });
    fireEvent.click(todayButton);
    expect(screen.getByRole("dialog", { name: "adapt" })).toBeVisible();
    expect(screen.getByText("适应")).toBeVisible();
    expect(screen.getByText("adapt means to fit to a new use")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "关闭词汇详情" }));
    fireEvent.click(screen.getByRole("button", { name: "learn，近 7 日词" }));
    expect(screen.getByRole("dialog", { name: "learn" })).toBeVisible();
    expect(screen.getByText("学习")).toBeVisible();
    expect(screen.queryByText(/词根|前缀|后缀/)).not.toBeInTheDocument();
    const close = screen.getByRole("button", { name: "关闭词汇详情" });
    fireEvent.keyDown(close, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "learn" }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "learn，近 7 日词" })).toHaveFocus());
  });

  it("routes unverified viewers to login and returns the same not-found result for non-members", async () => {
    mocks.getOptionalViewer.mockResolvedValue({ userId: "reader-1", email: "reader@example.test", emailVerified: false });
    await expect(DailyReadingArticlePage({ params: Promise.resolve({ id: "article-1" }) })).rejects.toThrow("NEXT_REDIRECT:/login?next=%2Freading%2Fdaily%2Farticle-1");
    expect(mocks.loadDailyReadingArticlePageData).not.toHaveBeenCalled();

    mocks.getOptionalViewer.mockResolvedValue({ userId: "reader-1", email: "reader@example.test", emailVerified: true });
    mocks.loadDailyReadingArticlePageData.mockResolvedValue(null);
    await expect(DailyReadingArticlePage({ params: Promise.resolve({ id: "other" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.loadDailyReadingArticlePageData).toHaveBeenCalledWith("reader-1", "other");
  });

  it("builds the reader page from its server loader for a current Daily-3 member", async () => {
    mocks.getOptionalViewer.mockResolvedValue({ userId: "reader-1", email: "reader@example.test", emailVerified: true });
    mocks.loadDailyReadingArticlePageData.mockResolvedValue({ article, words, summaryTokens: [{ text: "A " }, { text: "learn", wordId: "learn-id", level: "recent-7-day" }], initialState: { openedAt: null, completedAt: null } });
    render(await DailyReadingArticlePage({ params: Promise.resolve({ id: "article-1" }) }));
    expect(mocks.loadDailyReadingArticlePageData).toHaveBeenCalledWith("reader-1", "article-1");
    expect(screen.getByRole("heading", { name: "A science story" })).toBeVisible();
  });

  it("hydrates persisted state, marks opening/completion only through the Daily-3 endpoint, and survives refresh", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const patch = JSON.parse(String(init?.body ?? "{}")) as { opened?: true; completed?: true };
      return { ok: true, json: async () => ({ state: { openedAt: patch.opened ? "2026-09-24T10:00:00.000Z" : null, completedAt: patch.completed ? "2026-09-24T11:00:00.000Z" : null } }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<DailyReadingArticle article={article} words={words} summaryTokens={summaryTokens} initialState={{ openedAt: null, completedAt: null }} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/reading/articles/article-1/state", expect.objectContaining({ method: "POST", body: '{"opened":true}' })));
    fireEvent.click(screen.getByRole("button", { name: "完成阅读" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/reading/articles/article-1/state", expect.objectContaining({ body: '{"completed":true}' })));
    expect(screen.getByText("已完成阅读")).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/today/events", expect.anything());

    fetchMock.mockClear();
    unmount();
    render(<DailyReadingArticle article={article} words={words} summaryTokens={summaryTokens} initialState={{ openedAt: "2026-09-24T10:00:00.000Z", completedAt: "2026-09-24T11:00:00.000Z" }} />);
    expect(screen.getByText("已完成阅读")).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/reading/articles/article-1/state", expect.anything());
  });

  it("offers a retry after a failed read-state request", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    render(<DailyReadingArticle article={article} words={words} summaryTokens={summaryTokens} initialState={{ openedAt: null, completedAt: null }} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("阅读状态保存失败");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ state: { openedAt: "2026-09-24T10:00:00.000Z", completedAt: null } }) });
    fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("shows optional practice only after confirmed completion and safe capacity", async () => {
    const fetchMock = vi.fn(async (url: string) => url.endsWith("/state")
      ? {ok: true, json: async () => ({state: {openedAt: "2026-09-25T00:00:00Z", completedAt: "2026-09-25T01:00:00Z"}})}
      : {ok: true, json: async () => ({saved: true})});
    vi.stubGlobal("fetch", fetchMock);
    render(<DailyReadingArticle article={article} words={words} summaryTokens={summaryTokens}
      initialState={{openedAt: "2026-09-25T00:00:00Z", completedAt: null}}
      reinforcement={{availableCount: 3, sessionId: null, status: "not-started"}} />);
    expect(screen.queryByRole("button", {name: /快速巩固/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name: "完成阅读"}));
    expect(await screen.findByRole("button", {name: "快速巩固 3 个词"})).toBeVisible();
    expect(screen.getByText("已完成阅读")).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/reading/articles/article-1/evidence",
      expect.objectContaining({body: JSON.stringify({action: "exposure", wordId: "adapt-id"})})));
  });

  it("starts practice through the verified route and omits the CTA when no safe context exists", async () => {
    const fetchMock = vi.fn(async (url: string) => url.endsWith("/reinforcement")
      ? {ok: true, json: async () => ({kind: "session", session: {id: "session-1"}})}
      : {ok: true, json: async () => ({saved: true})});
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<DailyReadingArticle article={article} words={words} summaryTokens={summaryTokens}
      initialState={{openedAt: "2026-09-25T00:00:00Z", completedAt: "2026-09-25T01:00:00Z"}}
      reinforcement={{availableCount: 3, sessionId: null, status: "not-started"}} />);
    fireEvent.click(screen.getByRole("button", {name: "快速巩固 3 个词"}));
    await waitFor(() => expect(mocks.routerPush).toHaveBeenCalledWith("/reading/reinforcement/session-1"));
    expect(fetchMock).toHaveBeenCalledWith("/api/reading/articles/article-1/reinforcement", {method: "POST"});
    view.unmount();
    render(<DailyReadingArticle article={article} words={words} summaryTokens={summaryTokens}
      initialState={{openedAt: "2026-09-25T00:00:00Z", completedAt: "2026-09-25T01:00:00Z"}}
      reinforcement={{availableCount: 0, sessionId: null, status: "not-started"}} />);
    expect(screen.queryByRole("button", {name: /快速巩固/})).not.toBeInTheDocument();
  });

  it("keeps the word dialog open when detail evidence fails and offers retry", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body ?? "{}")) as {action?: string};
      if (payload.action === "detail-open") return {ok: false};
      return {ok: true, json: async () => ({saved: true})};
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<DailyReadingArticle article={article} words={words} summaryTokens={summaryTokens} />);
    fireEvent.click(screen.getByRole("button", {name: "Adapt，今日词"}));
    expect(screen.getByRole("dialog", {name: "adapt"})).toBeVisible();
    expect(await screen.findByText(/阅读词汇记录保存失败/)).toBeVisible();
    fetchMock.mockImplementation(async () => ({ok: true, json: async () => ({saved: true})}));
    fireEvent.click(screen.getByRole("button", {name: "重试词汇记录"}));
    await waitFor(() => expect(screen.queryByText(/阅读词汇记录保存失败/)).not.toBeInTheDocument());
  });
});
