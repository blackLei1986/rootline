import { describe, expect, it } from "vitest";
import { createReadingReinforcementService } from "@/lib/reading/reinforcement/service";
import { createReadingSessionGetHandler, createReadingSessionStartPostHandler } from "@/lib/reading/reinforcement/http";
import type { ReadingSessionRow } from "@/lib/reading/reinforcement/types";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";
import type { ViewerDTO } from "@/types/auth";

const article = {articleId: "article-1", title: "Report", summary: "Teams adapt methods, analyze results, and explain findings.",
  matchedTodayWordIds: ["adapt"], matchedRecentWordIds: ["analyze", "explain"],
  matchedRecent7DayWordIds: ["analyze", "explain"]} as DailyReadingRecommendation;
const words = [
  {id: "adapt", lemma: "adapt", word: "adapt", surfaceForms: ["adapt"], coreMeaningZh: "适应", coreDefinitionEn: "change"},
  {id: "analyze", lemma: "analyze", word: "analyze", surfaceForms: ["analyze"], coreMeaningZh: "分析", coreDefinitionEn: "inspect"},
  {id: "explain", lemma: "explain", word: "explain", surfaceForms: ["explain"], coreMeaningZh: "解释", coreDefinitionEn: "describe"}
] as ProductionVocabularyEntry[];

function fixture() {
  let currentDate = "2026-09-25";
  let completed = true;
  let currentArticle: DailyReadingRecommendation | null = article;
  let vocabulary = words;
  const sessions = new Map<string, ReadingSessionRow>();
  const repository = {
    appendWeakEvidence: async () => true,
    getByArticle: async (userId: string, articleId: string) => sessions.get(`${userId}:${articleId}`) ?? null,
    getById: async (userId: string, sessionId: string) => [...sessions.values()].find((row) => row.user_id === userId && row.id === sessionId) ?? null,
    createOnce: async (userId: string, articleId: string, learningDate: string, questions: ReadingSessionRow["questions"]) => {
      const key = `${userId}:${articleId}`;
      const prior = sessions.get(key);
      if (prior) return prior;
      const row = {id: "session-1", user_id: userId, article_id: articleId, learning_date: learningDate,
        status: "active", revision: 0, cursor: 0, questions, outcomes: [],
        created_at: "2026-09-25T00:00:00Z", updated_at: "2026-09-25T00:00:00Z", completed_at: null} as ReadingSessionRow;
      sessions.set(key, row);
      return row;
    }
  };
  const service = createReadingReinforcementService({
    getCurrentArticle: async (_userId, articleId) => currentArticle && articleId === currentArticle.articleId
      ? {article: currentArticle, learningDate: currentDate} : null,
    getVocabulary: async () => vocabulary,
    getArticleState: async () => ({openedAt: "2026-09-25T00:00:00Z", completedAt: completed ? "2026-09-25T01:00:00Z" : null}),
    getWordStates: async () => ({}), getOpenedWordIds: async () => [], repository
  });
  return {service, sessions, setDate: (value: string) => {currentDate = value;},
    setCompleted: (value: boolean) => {completed = value;},
    setArticle: (value: DailyReadingRecommendation | null) => {currentArticle = value;},
    setVocabulary: (value: ProductionVocabularyEntry[]) => {vocabulary = value;}};
}

describe("reading practice session", () => {
  it("freezes one answer-key set and returns only public current-question fields", async () => {
    const {service, setVocabulary} = fixture();
    const started = await service.startOrResume("owner", "article-1");
    expect(started.kind).toBe("session");
    if (started.kind !== "session") throw new Error("Expected session");
    expect(started.session.total).toBe(3);
    expect(JSON.stringify(started.session)).not.toContain("acceptedAnswers");
    expect(JSON.stringify(started.session)).not.toContain("correctDisplay");
    setVocabulary([]);
    expect(await service.startOrResume("owner", "article-1")).toEqual(started);
    expect((await service.getOwnedSession("owner", started.session.id))?.id).toBe(started.session.id);
    expect(await service.getOwnedSession("other", started.session.id)).toBeNull();
  });

  it("resumes by owned ID across dates but does not start an old absent article", async () => {
    const {service, setDate, setArticle} = fixture();
    const started = await service.startOrResume("owner", "article-1");
    expect(started.kind).toBe("session");
    if (started.kind !== "session") throw new Error("Expected session");
    setDate("2026-09-26");
    setArticle(null);
    expect((await service.getOwnedSession("owner", started.session.id))?.cursor).toBe(0);
    expect((await service.startOrResume("owner", "old-article")).kind).toBe("not-found");
  });

  it("does not start before article completion or when no safe question exists", async () => {
    const {service, setCompleted, setArticle} = fixture();
    setCompleted(false);
    expect((await service.startOrResume("owner", "article-1")).kind).toBe("unfinished");
    setCompleted(true);
    setArticle({...article, summary: "No highlighted target appears here."});
    expect(await service.startOrResume("owner", "article-1")).toEqual({kind: "empty", availableCount: 0});
  });

  it("maps unavailable and unfinished states to non-disclosing HTTP responses", async () => {
    const {service, setCompleted} = fixture();
    const viewer = {userId: "owner", email: "owner@example.org", emailVerified: true} as ViewerDTO;
    const start = createReadingSessionStartPostHandler({requireViewer: async () => viewer, getService: () => service});
    const unknown = await start(new Request("http://local/start", {method: "POST"}), {params: Promise.resolve({id: "other"})});
    expect(unknown.status).toBe(404);
    setCompleted(false);
    const unfinished = await start(new Request("http://local/start", {method: "POST"}), {params: Promise.resolve({id: "article-1"})});
    expect(unfinished.status).toBe(409);
    const get = createReadingSessionGetHandler({requireViewer: async () => viewer, getService: () => service});
    expect((await get(new Request("http://local/session"), {params: Promise.resolve({sessionId: "unknown"})})).status).toBe(404);
  });
});
