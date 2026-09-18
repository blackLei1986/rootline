import { describe, expect, it } from "vitest";
import { runRssReadingAudit } from "@/scripts/rss-reading-audit";

describe("RSS Reading audit", () => {
  it("enforces security, production vocabulary, and candidate-count gates", () => {
    const result = runRssReadingAudit(process.cwd());
    expect(result.missing, result.missing.join("\n")).toEqual([]);
    expect(result.checks).toBeGreaterThanOrEqual(18);
    expect(result.acceptedLemmaCount).toBe(9_000);
  });
});
