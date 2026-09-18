import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createFullVocabularyProductionReport } from "@/lib/vocabulary-production-report";
import type { ProductionVocabularyEntry } from "@/types";

async function main() {
  const directory = resolve(process.cwd(), "public/vocabulary-data");
  const files = (await readdir(directory)).filter((file) => /^[a-z]\.json$/.test(file)).sort();
  const catalog = (await Promise.all(files.map(async (file) => JSON.parse(await readFile(resolve(directory, file), "utf8")) as ProductionVocabularyEntry[]))).flat();
  const report = createFullVocabularyProductionReport(catalog);

  console.log("Vocabulary Production Report");
  console.log(JSON.stringify(report, null, 2));
  if (!report.finalGatePassed || report.needsReview.length || report.duplicateCandidates.length || report.tierDepthIssues.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
