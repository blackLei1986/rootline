// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getProductionReadingIndex } from "@/lib/reading/production-index";

describe("production Reading index", () => {
  it("indexes every accepted production lemma exactly once", async () => {
    const index = await getProductionReadingIndex();
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "data/vocabulary/production-manifest.json"), "utf8")) as { acceptedLemmaCount: number };
    expect(index.acceptedLemmaCount).toBe(manifest.acceptedLemmaCount);
    expect(index.byLemma.size).toBe(manifest.acceptedLemmaCount);
    expect(index.bySurfaceForm.get("analyses")?.lemma).toBe("analysis");
  });
});
