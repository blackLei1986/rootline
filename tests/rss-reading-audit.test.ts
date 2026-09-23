import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runRssReadingAudit } from "@/scripts/rss-reading-audit";

describe("RSS Reading audit", () => {
  it("enforces security, production vocabulary, and candidate-count gates", () => {
    const result = runRssReadingAudit(process.cwd());
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "data/vocabulary/production-manifest.json"), "utf8")) as { acceptedLemmaCount: number };
    expect(result.missing, result.missing.join("\n")).toEqual([]);
    expect(result.checks).toBeGreaterThanOrEqual(18);
    expect(result.acceptedLemmaCount).toBe(manifest.acceptedLemmaCount);
  });
});
