import { describe, expect, test } from "vitest";
import { FixtureAIProvider } from "@/pipeline/generate/provider";
import { generateCandidate } from "@/pipeline/generate";
import { importSeeds } from "@/pipeline/import";
import { significantCandidate } from "@/pipeline/fixtures/significant";
import { scoreCandidate } from "@/pipeline/score";
import { validateCandidate } from "@/pipeline/validate";
import { vocabularyCandidatePayloadSchema } from "@/pipeline/schema";

describe("vocabulary pipeline", () => {
  test("strict schema accepts the reviewed pilot fixture", () => {
    expect(vocabularyCandidatePayloadSchema.safeParse(significantCandidate).success).toBe(true);
  });
  test("generation is retry-bounded and moves through validation and scoring", async () => {
    const state = importSeeds([{ word: "Significant", source: "pilot" }]);
    const generated = await generateCandidate(state.candidates[0], new FixtureAIProvider({ significant: significantCandidate }));
    const validated = validateCandidate(generated);
    const scored = scoreCandidate(validated);
    expect(generated.attempts).toBe(1);
    expect(validated.status).toBe("validated");
    expect(scored.qualityScore).toBeGreaterThanOrEqual(85);
    expect(scored.status).toBe("accepted");
  });
});
