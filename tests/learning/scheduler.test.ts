import { describe, it, expect } from "vitest";
import {
  RATING,
  NEW_INTERVAL_DAYS,
  MINUTES_PER_DAY,
  scheduleReview,
  calculatePriority,
  calculateFamiliarity,
  selectDailyQueue,
  isMastered,
  type WordProgress,
  type QueueItem,
} from "@/lib/learning/scheduler";

const NOW = new Date("2026-09-18T00:00:00Z");

function newWord(): WordProgress {
  return {
    state: "new",
    stability: 0,
    difficulty: 5,
    reviewCount: 0,
    lapseCount: 0,
    streak: 0,
    lastRating: null,
    intervalDays: 0,
  };
}

describe("scheduleReview — new word first feedback", () => {
  it("Again -> ~10 minutes, learning state, one lapse", () => {
    const r = scheduleReview({ progress: newWord(), rating: RATING.AGAIN, now: NOW });
    expect(r.intervalDays).toBeCloseTo(10 / MINUTES_PER_DAY, 3);
    expect(r.state).toBe("learning");
    expect(r.lapseCount).toBe(1);
    expect(r.streak).toBe(0);
    expect(r.reviewCount).toBe(1);
    expect(r.mastered).toBe(false);
  });

  it("Good -> 2 days, review state, streak 1", () => {
    const r = scheduleReview({ progress: newWord(), rating: RATING.GOOD, now: NOW });
    expect(r.intervalDays).toBe(2);
    expect(r.state).toBe("review");
    expect(r.streak).toBe(1);
    expect(r.lapseCount).toBe(0);
  });

  it("Easy -> 4 days (longer than Good)", () => {
    const easy = scheduleReview({ progress: newWord(), rating: RATING.EASY, now: NOW });
    const good = scheduleReview({ progress: newWord(), rating: RATING.GOOD, now: NOW });
    expect(easy.intervalDays).toBe(4);
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
  });
});

describe("scheduleReview — review phase dynamic interval", () => {
  it("consecutive Good grows the interval", () => {
    const first = scheduleReview({ progress: newWord(), rating: RATING.GOOD, now: NOW });
    const second = scheduleReview({
      progress: { ...newWord(), state: "review", stability: first.stability, difficulty: first.difficulty, reviewCount: 1, lapseCount: 0, streak: 1, lastRating: RATING.GOOD, intervalDays: first.intervalDays },
      rating: RATING.GOOD,
      now: NOW,
    });
    expect(second.intervalDays).toBeGreaterThan(first.intervalDays);
    expect(second.streak).toBe(2);
  });

  it("Easy yields a larger interval than Good from the same state", () => {
    const base: WordProgress = { ...newWord(), state: "review", stability: 2, reviewCount: 1, streak: 1 };
    const good = scheduleReview({ progress: base, rating: RATING.GOOD, now: NOW });
    const easy = scheduleReview({ progress: base, rating: RATING.EASY, now: NOW });
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
  });

  it("consecutive Again: lapse grows, stability decays, streak resets", () => {
    let p: WordProgress = { ...newWord(), state: "review", stability: 2, reviewCount: 1, streak: 1 };
    const results = [RATING.AGAIN, RATING.AGAIN, RATING.AGAIN].map((rating) => {
      const r = scheduleReview({ progress: p, rating, now: NOW });
      p = { ...p, state: r.state, stability: r.stability, difficulty: r.difficulty, reviewCount: r.reviewCount, lapseCount: r.lapseCount, streak: r.streak, lastRating: r.lastRating, intervalDays: r.intervalDays };
      return r;
    });

    expect(results[0].lapseCount).toBe(1);
    expect(results[1].lapseCount).toBe(2);
    expect(results[2].lapseCount).toBe(3);
    // stability keeps decaying toward the ~10min floor
    expect(results[1].stability).toBeLessThan(results[0].stability);
    expect(results[2].stability).toBeLessThanOrEqual(results[1].stability);
    expect(results[2].streak).toBe(0);
    expect(results[2].state).toBe("learning");
  });
});

describe("mastery", () => {
  it("one correct answer is NOT enough", () => {
    const once = scheduleReview({ progress: newWord(), rating: RATING.GOOD, now: NOW });
    expect(once.mastered).toBe(false);
  });

  it("requires streak >= 4, stability >= 30, interval >= 21, low error rate", () => {
    const mastered: WordProgress = {
      state: "review",
      stability: 30,
      difficulty: 3,
      reviewCount: 20,
      lapseCount: 2, // 10% error rate
      streak: 4,
      lastRating: RATING.GOOD,
      intervalDays: 21,
    };
    expect(isMastered(mastered)).toBe(true);
  });

  it("rejects on short streak / low stability / high error rate", () => {
    const shortStreak: WordProgress = { ...newWord(), state: "review", stability: 40, reviewCount: 20, lapseCount: 0, streak: 3, intervalDays: 30 };
    const lowStability: WordProgress = { ...newWord(), state: "review", stability: 29, reviewCount: 20, lapseCount: 0, streak: 5, intervalDays: 30 };
    const highError: WordProgress = { ...newWord(), state: "review", stability: 40, reviewCount: 10, lapseCount: 5, streak: 5, intervalDays: 30 };
    expect(isMastered(shortStreak)).toBe(false);
    expect(isMastered(lowStability)).toBe(false);
    expect(isMastered(highError)).toBe(false);
  });
});

describe("calculatePriority", () => {
  it("overdue word outranks a fresh one", () => {
    const base = { stability: 5, frequencyRank: 5000, examTagCount: 0, readingExposure: 0, lapseCount: 0 };
    const overdue = calculatePriority({ ...base, overdueDays: 20 });
    const fresh = calculatePriority({ ...base, overdueDays: 0 });
    expect(overdue).toBeGreaterThan(fresh);
  });

  it("high-frequency word outranks a low-frequency one", () => {
    const base = { overdueDays: 0, stability: 5, examTagCount: 0, readingExposure: 0, lapseCount: 0 };
    const highFreq = calculatePriority({ ...base, frequencyRank: 100 });
    const lowFreq = calculatePriority({ ...base, frequencyRank: 9000 });
    expect(highFreq).toBeGreaterThan(lowFreq);
  });
});

describe("calculateFamiliarity", () => {
  it("grows with stability and streak", () => {
    const low = calculateFamiliarity(newWord());
    const high = calculateFamiliarity({
      ...newWord(), state: "review", stability: 30, reviewCount: 20, lapseCount: 0, streak: 4, intervalDays: 30,
    });
    expect(high).toBeGreaterThan(low);
  });
});

describe("selectDailyQueue", () => {
  const makeItems = (n: number, over: number): QueueItem[] =>
    Array.from({ length: n }, (_, i) => ({
      wordId: `w${i}`,
      priorityScore: 0.5,
      frequencyRank: i,
      overdueDays: over,
    }));

  it("normal load splits 60/20/20", () => {
    const r = selectDailyQueue({
      overdue: makeItems(20, 1),
      weak: makeItems(20, 0),
      newWords: makeItems(20, 0),
      targetCount: 20,
    });
    expect(r.overdue.length).toBe(12); // 60%
    expect(r.weak.length).toBe(4); // 20%
    expect(r.newWords.length).toBe(4); // 20%
  });

  it("severe backlog reduces new words", () => {
    const r = selectDailyQueue({
      overdue: makeItems(100, 1),
      weak: makeItems(10, 0),
      newWords: makeItems(10, 0),
      targetCount: 20,
    });
    expect(r.newWords.length).toBeLessThanOrEqual(2); // 5% + backfill cap
    expect(r.overdue.length).toBeGreaterThan(15);
  });

  it("sorts new words by frequency (high-frequency first)", () => {
    const newWords: QueueItem[] = [
      { wordId: "low", priorityScore: 0, frequencyRank: 9000, overdueDays: 0 },
      { wordId: "high", priorityScore: 0, frequencyRank: 50, overdueDays: 0 },
      { wordId: "mid", priorityScore: 0, frequencyRank: 5000, overdueDays: 0 },
    ];
    const r = selectDailyQueue({
      overdue: [],
      weak: [],
      newWords,
      targetCount: 3,
    });
    expect(r.newWords.map((w) => w.wordId)).toEqual(["high", "mid", "low"]);
  });
});

describe("determinism", () => {
  it("same input yields identical output", () => {
    const a = scheduleReview({ progress: newWord(), rating: RATING.GOOD, now: NOW });
    const b = scheduleReview({ progress: newWord(), rating: RATING.GOOD, now: NOW });
    expect(a).toEqual(b);
  });
});
