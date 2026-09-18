// @vitest-environment node

import { describe, expect, it } from "vitest";
import { getProductionReadingIndex } from "@/lib/reading/production-index";

describe("production Reading index", () => {
  it("indexes every accepted production lemma exactly once", async () => {
    const index = await getProductionReadingIndex();
    expect(index.acceptedLemmaCount).toBe(9_000);
    expect(index.byLemma.size).toBe(9_000);
    expect(index.bySurfaceForm.get("analyses")?.lemma).toBe("analysis");
  });
});
