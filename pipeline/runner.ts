import { markDuplicateCandidates } from "@/pipeline/deduplicate";
import { exportAccepted } from "@/pipeline/export";
import { FixtureAIProvider } from "@/pipeline/generate/provider";
import { generateCandidate } from "@/pipeline/generate";
import { importSeeds } from "@/pipeline/import";
import { createCoverageReport, createQualityReport } from "@/pipeline/reports";
import { scoreCandidate } from "@/pipeline/score";
import { significantCandidate } from "@/pipeline/fixtures/significant";
import type { PipelineRunOptions, PipelineState, SeedWord } from "@/pipeline/types";
import { validateCandidate } from "@/pipeline/validate";

export const pilotSeeds: SeedWord[] = [{ word: "significant", source: "rootline-editorial-pilot" }];
const provider = new FixtureAIProvider({ significant: significantCandidate });

export async function runPipeline(command: string, state: PipelineState | undefined, options: PipelineRunOptions) {
  let next = state ?? importSeeds(pilotSeeds);
  const limited = next.candidates.slice(0, options.limit);
  if (command === "import") next = importSeeds(pilotSeeds, state);
  if (command === "generate") {
    const generated = await Promise.all(limited.map((candidate) => generateCandidate(candidate, provider)));
    next = { ...next, candidates: [...generated, ...next.candidates.slice(options.limit)] };
  }
  if (command === "validate") next = { ...next, candidates: markDuplicateCandidates(limited.map(validateCandidate)).concat(next.candidates.slice(options.limit)) };
  if (command === "audit") next = { ...next, candidates: markDuplicateCandidates(limited.map(validateCandidate).map(scoreCandidate)).concat(next.candidates.slice(options.limit)) };
  if (command === "report") return { state: next, output: { coverage: createCoverageReport(), quality: createQualityReport(next) } };
  if (command === "export") return { state: next, output: exportAccepted(next) };
  return { state: next, output: createQualityReport(next) };
}
