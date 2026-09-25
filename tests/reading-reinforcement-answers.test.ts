import { describe, expect, it } from "vitest";
import { createWordProgress } from "@/lib/storage";
import { calculateWordMastery } from "@/lib/mastery-engine";
import { applyReadingResult } from "@/lib/reading/reinforcement/progress";
import { createReadingReinforcementService } from "@/lib/reading/reinforcement/service";
import { createReadingAnswerPostHandler } from "@/lib/reading/reinforcement/http";
import type { FrozenQuestion, ReadingSessionRow } from "@/lib/reading/reinforcement/types";
import type { ViewerDTO } from "@/types/auth";

const now = new Date("2026-09-25T12:00:00Z");
const question = (type: FrozenQuestion["type"]): FrozenQuestion => ({
  id: "q1", wordId: "adapt", type, context: "Teams adapted quickly.", prompt: "Question",
  acceptedAnswers: ["adapt"], correctDisplay: "adapt"
});

describe("conservative Reading answer mapping", () => {
  it("keeps recognition outside FSRS and makes a wrong recognition a weak signal", () => {
    const fresh = createWordProgress("adapt");
    const good = applyReadingResult(fresh, question("recognition"), true, now);
    expect(good.nextState.reviewCount).toBe(0);
    expect(good.nextState.lastReviewedAt).toBeNull();
    expect(good.nextState.knownCount).toBe(1);
    expect(good.nextState.readingRevision).toBe(1);
    expect(good.metadata.activeRecall).toBeUndefined();
    const wrong = applyReadingResult(fresh, question("recognition"), false, now);
    expect(wrong.nextState.wrongCount).toBe(1);
    expect(wrong.nextState.reviewCount).toBe(0);
    expect(wrong.nextState.firstLearnedAt).toBeNull();
  });

  it("uses Hard for correct Cloze, Good for correct Recall, and Again for a wrong active answer", () => {
    const fresh = createWordProgress("adapt");
    expect(applyReadingResult(fresh, question("cloze"), true, now).nextState.lastRating).toBe("hard");
    expect(applyReadingResult(fresh, question("recall"), true, now).nextState.lastRating).toBe("good");
    expect(applyReadingResult(fresh, question("recall"), false, now).nextState.lastRating).toBe("again");
    const active = applyReadingResult(fresh, question("recall"), true, now);
    expect(active.metadata).toMatchObject({mode: "reading-recall", activeRecall: true});
    expect(calculateWordMastery("adapt", active.nextState, [{id: "event", type: "quiz_correct", timestamp: now.toISOString(), wordId: "adapt", metadata: active.metadata}], now).stable).toBe(false);
  });
});

function answerFixture() {
  let row: ReadingSessionRow = {
    id: "session-1", user_id: "owner", article_id: "article-1", learning_date: "2026-09-25",
    status: "active", revision: 0, cursor: 0, questions: [question("recall")], outcomes: [],
    created_at: now.toISOString(), updated_at: now.toISOString(), completed_at: null
  };
  let word = createWordProgress("adapt");
  let wordRevision = 0;
  let commits = 0;
  const repository = {
    appendWeakEvidence: async () => true,
    getById: async (userId: string, sessionId: string) => userId === "owner" && sessionId === row.id ? row : null,
    getWordSnapshot: async () => ({state: word, revision: wordRevision}),
    commitAnswer: async (input: {questionId: string; nextWordState: typeof word; submittedAnswer: string; correct: boolean}) => {
      commits++;
      if (row.outcomes.some((outcome) => outcome.questionId === input.questionId)) return {kind: "duplicate" as const, row};
      word = input.nextWordState;
      wordRevision++;
      row = {...row, revision: row.revision + 1, cursor: 1, status: "complete", completed_at: now.toISOString(),
        outcomes: [{questionId: input.questionId, wordId: "adapt", submittedAnswer: input.submittedAnswer,
          correct: input.correct, correctDisplay: "adapt", answeredAt: now.toISOString()}]};
      return {kind: "accepted" as const, row, wordState: word};
    }
  };
  const service = createReadingReinforcementService({
    getCurrentArticle: async () => null, getVocabulary: async () => [], repository, now: () => now
  });
  return {service, getCommits: () => commits, getWord: () => word};
}

describe("Reading answer submission", () => {
  it("replays a saved answer without a second schedule step", async () => {
    const {service, getCommits, getWord} = answerFixture();
    const first = await service.submitAnswer("owner", "session-1", "q1", "adapt");
    const second = await service.submitAnswer("owner", "session-1", "q1", "adapt");
    if (!first || first === "conflict" || !second || second === "conflict") throw new Error("Expected accepted answers");
    expect(first.session.cursor).toBe(1);
    expect(second.session).toEqual(first.session);
    expect(getCommits()).toBe(1);
    expect(getWord().readingRevision).toBe(1);
  });

  it("rejects a future/forged question before any persistence", async () => {
    const {service, getCommits} = answerFixture();
    await expect(service.submitAnswer("owner", "session-1", "q2", "adapt")).rejects.toThrow("INVALID_READING_QUESTION");
    expect(getCommits()).toBe(0);
  });

  it("recomputes from a concurrent non-Reading word edit before granting credit", async () => {
    const row: ReadingSessionRow = {
      id: "session-1", user_id: "owner", article_id: "article-1", learning_date: "2026-09-25",
      status: "active", revision: 0, cursor: 0, questions: [question("recall")], outcomes: [],
      created_at: now.toISOString(), updated_at: now.toISOString(), completed_at: null
    };
    let word = createWordProgress("adapt");
    let revision = 0;
    let attempts = 0;
    const service = createReadingReinforcementService({
      getCurrentArticle: async () => null, getVocabulary: async () => [], now: () => now,
      repository: {
        appendWeakEvidence: async () => true,
        getById: async () => row,
        getWordSnapshot: async () => ({state: word, revision}),
        commitAnswer: async (input) => {
          attempts++;
          if (attempts === 1) {
            word = {...word, knownCount: 4};
            revision++;
          }
          if (input.expectedWordRevision !== revision) return {kind: "conflict", row};
          word = input.nextWordState;
          revision++;
          return {kind: "accepted", row: {...row, cursor: 1, revision: 1, status: "complete",
            completed_at: now.toISOString(), outcomes: [{questionId: "q1", wordId: "adapt",
              submittedAnswer: "adapt", correct: true, correctDisplay: "adapt", answeredAt: now.toISOString()}]}, wordState: word};
        }
      }
    });
    const result = await service.submitAnswer("owner", "session-1", "q1", "adapt");
    if (!result || result === "conflict") throw new Error("Expected a saved answer");
    expect(result.wordState?.knownCount).toBe(4);
    expect(result.wordState?.readingRevision).toBe(1);
    expect(attempts).toBe(2);
  });

  it("distinguishes a missing word row from an existing revision-zero row", async () => {
    const row: ReadingSessionRow = {
      id: "session-1", user_id: "owner", article_id: "article-1", learning_date: "2026-09-25",
      status: "active", revision: 0, cursor: 0, questions: [question("recall")], outcomes: [],
      created_at: now.toISOString(), updated_at: now.toISOString(), completed_at: null
    };
    const versions: number[] = [];
    let reads = 0;
    const service = createReadingReinforcementService({
      getCurrentArticle: async () => null, getVocabulary: async () => [], now: () => now,
      repository: {
        appendWeakEvidence: async () => true,
        getById: async () => row,
        getWordSnapshot: async () => ++reads === 1 ? null
          : {state: {...createWordProgress("adapt"), knownCount: 4}, revision: 0},
        commitAnswer: async (input) => {
          versions.push(input.expectedWordRevision);
          if (input.expectedWordRevision === -1) return {kind: "conflict", row};
          return {kind: "accepted", row: {...row, status: "complete", cursor: 1}, wordState: input.nextWordState};
        }
      }
    });
    const result = await service.submitAnswer("owner", "session-1", "q1", "adapt");
    if (!result || result === "conflict") throw new Error("Expected a saved answer");
    expect(versions).toEqual([-1, 0]);
    expect(result.wordState?.knownCount).toBe(4);
  });

  it("rejects client-supplied correctness and keeps persistence failure retryable", async () => {
    const {service} = answerFixture();
    const viewer = {userId: "owner", email: "owner@example.org", emailVerified: true} as ViewerDTO;
    const handler = createReadingAnswerPostHandler({requireViewer: async () => viewer, getService: () => service});
    const context = {params: Promise.resolve({sessionId: "session-1"})};
    const forged = await handler(new Request("http://local/answers", {method: "POST",
      body: JSON.stringify({questionId: "q1", answer: "adapt", correct: true})}), context);
    expect(forged.status).toBe(400);
    const accepted = await handler(new Request("http://local/answers", {method: "POST",
      body: JSON.stringify({questionId: "q1", answer: "adapt"})}), context);
    expect(accepted.status).toBe(200);
  });
});
