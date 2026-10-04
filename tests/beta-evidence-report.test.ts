import { describe, expect, it } from "vitest";
import { buildBetaEvidenceReport } from "@/lib/beta/evidence-report";

const row = (key: string, date: string, event: Record<string, unknown>, recordedAt: string) => ({
  event_key: key,
  learning_date: date,
  event_type: event.type as string,
  payload: event,
  deployment_commit: "beta-commit-1",
  recorded_at: recordedAt,
});

describe("persisted Beta daily evidence report", () => {
  it("groups two learning dates without losing prior-day duration, review, Journal or commit", () => {
    const report = buildBetaEvidenceReport("account-a", [
      row("a", "2026-10-04", { type: "plan-observed", targetCount: 30, newWordCount: 23, sourceCounts: { carryover: 7, weak: 2, "root-core": 16, support: 5 } }, "2026-10-04T01:00:00.000Z"),
      row("b", "2026-10-04", { type: "session-started", at: "2026-10-04T01:01:00.000Z" }, "2026-10-04T01:01:00.000Z"),
      row("c", "2026-10-04", { type: "activity-duration", activity: "block-a", milliseconds: 120_000 }, "2026-10-04T01:04:00.000Z"),
      row("d", "2026-10-04", { type: "review-outcome", kind: "mini", source: "carryover", originSource: "root-core", correct: true }, "2026-10-04T01:05:00.000Z"),
      row("e", "2026-10-04", { type: "journal", ratings: { difficulty: 3, fatigue: 2, rootUsefulness: 5, reviewUsefulness: 4 }, continueTomorrow: true, note: "okay" }, "2026-10-04T01:07:00.000Z"),
      row("f", "2026-10-04", { type: "session-completed", at: "2026-10-04T01:08:00.000Z" }, "2026-10-04T01:08:00.000Z"),
      row("g", "2026-10-05", { type: "today-open" }, "2026-10-05T01:00:00.000Z"),
    ]);
    expect(report.accountId).toBe("account-a");
    expect(report.days).toHaveLength(2);
    expect(report.days[0]).toMatchObject({ learningDate: "2026-10-04", targetCount: 30, newWordCount: 23, activeMilliseconds: 120_000, totalTodayMilliseconds: 420_000, sourceCounts: { carryover: 7, weak: 2, "root-core": 16, support: 5 }, deploymentCommits: ["beta-commit-1"], journal: { continueTomorrow: true } });
    expect(report.days[0].reviewOutcomes["mini:carryover:root-core"]).toEqual({ correct: 1, total: 1 });
    expect(report.days[1].learningDate).toBe("2026-10-05");
  });

  it("counts a completed Reading session once and excludes malformed persisted payloads", () => {
    const report = buildBetaEvidenceReport("account-a", [
      row("a", "2026-10-04", { type: "reading-observed", sessionToken: "0123456789abcdef" }, "2026-10-04T01:00:00.000Z"),
      row("b", "2026-10-04", { type: "reading-completed", sessionToken: "0123456789abcdef" }, "2026-10-04T01:01:00.000Z"),
      row("c", "2026-10-04", { type: "reading-completed", sessionToken: "0123456789abcdef" }, "2026-10-04T01:02:00.000Z"),
      row("d", "2026-10-04", { type: "journal", note: "unvalidated" }, "2026-10-04T01:03:00.000Z"),
    ]);
    expect(report.days[0].readingCompletions).toBe(1);
    expect(report.days[0].invalidEventCount).toBe(1);
    expect(JSON.stringify(report)).not.toContain("0123456789abcdef");
  });
});
