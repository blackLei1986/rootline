import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { passesProductionAcceptedMinimum } from "@/lib/vocabulary-production-report";
import type { ProductionVocabularyEntry } from "@/types";

const EXPECTED_ACCEPTED_LEMMAS = 9_000;

async function main() {
  const directory = resolve(process.cwd(), "public", "vocabulary-data");
  const files = (await readdir(directory)).filter((file) => /^[a-z]\.json$/.test(file)).sort();
  const catalog = (await Promise.all(
    files.map(async (file) => JSON.parse(await readFile(resolve(directory, file), "utf8")) as ProductionVocabularyEntry[])
  )).flat();
  const accepted = catalog.filter(passesProductionAcceptedMinimum);
  const byLemma = new Map<string, ProductionVocabularyEntry>();

  for (const entry of accepted) {
    const lemma = normalize(entry.lemma);
    if (byLemma.has(lemma)) throw new Error(`Duplicate accepted lemma: ${lemma}`);
    if (!entry.id) throw new Error(`Accepted lemma has no word ID: ${lemma}`);
    byLemma.set(lemma, entry);
  }
  if (byLemma.size !== EXPECTED_ACCEPTED_LEMMAS) {
    throw new Error(`Reading index requires ${EXPECTED_ACCEPTED_LEMMAS} accepted lemmas; found ${byLemma.size}.`);
  }

  const entries = [...byLemma.entries()].map(([lemma, entry]) => ({
    id: entry.id,
    lemma,
    surfaceForms: [...new Set([entry.word, entry.lemma, ...entry.surfaceForms].map(normalize).filter(Boolean))],
    familyId: entry.wordFamilyId,
    contentTier: entry.contentTier,
    frequencyRank: entry.frequencyRank,
    learningValue: entry.learningValueScore,
    coverageTags: entry.coverageTags
  }));
  const output = {
    vocabularyVersion: "2026.09.production-v1",
    acceptedLemmaCount: entries.length,
    entries
  };
  const outputPath = resolve(process.cwd(), "data", "vocabulary", "reading-index.json");
  await writeFile(outputPath, `${JSON.stringify(output)}\n`);
  console.log(JSON.stringify({ output: "data/vocabulary/reading-index.json", acceptedLemmaCount: entries.length }));
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
