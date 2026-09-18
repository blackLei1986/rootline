import { describe, expect, it } from "vitest";
import { insertReinforcementItem } from "../lib/reinforcement";
import type { LearningSession, LearningSessionItem } from "../types/session";

const source: LearningSessionItem = {
  id: "quiz-inspect",
  type: "quiz",
  stage: "mixed-quiz",
  wordId: "inspect",
  rootId: "spect",
  mode: "word-to-meaning"
};

function makeSession(): LearningSession {
  return {
    id: "session-test",
    startedAt: "2026-09-17T00:00:00.000Z",
    rootIds: ["spect"],
    newWordIds: ["inspect"],
    reviewWordIds: [],
    items: [source, ...Array.from({ length: 8 }, (_, index) => ({
      id: `filler-${index}`,
      type: "quiz" as const,
      stage: "mixed-quiz" as const,
      wordId: `word-${index}`,
      mode: "word-to-meaning" as const
    }))],
    currentIndex: 0,
    answers: [],
    reinforcementCounts: {},
    rootMasteryBefore: { spect: 0 }
  };
}

describe("insertReinforcementItem", () => {
  it("reintroduces a wrong word after two to five intervening items", () => {
    const earliest = insertReinforcementItem(makeSession(), source, () => 0);
    const latest = insertReinforcementItem(makeSession(), source, () => 0.999);
    expect(earliest.items.findIndex((item) => item.reinforcement)).toBe(3);
    expect(latest.items.findIndex((item) => item.reinforcement)).toBe(6);
  });

  it("caps quick relearning at three appearances", () => {
    let session = makeSession();
    session = insertReinforcementItem(session, source, () => 0);
    session = insertReinforcementItem(session, source, () => 0);
    session = insertReinforcementItem(session, source, () => 0);
    const countAfterThree = session.items.length;
    session = insertReinforcementItem(session, source, () => 0);
    expect(session.reinforcementCounts.inspect).toBe(3);
    expect(session.items).toHaveLength(countAfterThree);
  });

  it("counts quiz questions rather than intro cards in the spacing gap", () => {
    const session = makeSession();
    session.items.splice(1, 0,
      { id: "intro-a", type: "word", stage: "word-intro", wordId: "a" },
      { id: "intro-b", type: "word", stage: "word-intro", wordId: "b" }
    );
    const next = insertReinforcementItem(session, source, () => 0);
    const repeatIndex = next.items.findIndex((item) => item.reinforcement);
    const interveningQuestions = next.items
      .slice(session.currentIndex + 1, repeatIndex)
      .filter((item) => item.type === "quiz");
    expect(interveningQuestions).toHaveLength(2);
  });
});
