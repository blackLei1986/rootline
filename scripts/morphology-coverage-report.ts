import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { words } from "@/data/words";
import { buildMorphologyCoverageReport } from "@/lib/morphology/audit";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

const catalogPath = resolve(process.cwd(), "data/vocabulary/production-catalog.json");

async function main() {
  const vocabulary = JSON.parse(await readFile(catalogPath, "utf8")) as ProductionVocabularyEntry[];
  const report = buildMorphologyCoverageReport({ vocabulary, curatedWords: words });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
