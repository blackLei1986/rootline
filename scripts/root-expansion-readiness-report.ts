import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { rootExpansionCandidates } from "@/lib/morphology/root-expansion-candidates";
import { buildRootExpansionReadinessReport } from "@/lib/morphology/root-expansion-report";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

async function main(): Promise<void> {
  const vocabulary = JSON.parse(
    await readFile(resolve(process.cwd(), "data/vocabulary/production-catalog.json"), "utf8")
  ) as ProductionVocabularyEntry[];
  const report = buildRootExpansionReadinessReport({
    vocabulary,
    proposals: rootExpansionCandidates
  });
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
