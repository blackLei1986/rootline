import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { simulateDaily30 } from "@/lib/morphology/daily30-simulator";
import { buildPersistedRootExpansionReport } from "@/lib/morphology/root-expansion-service";
import { SupabaseMorphologyCoverageRepository } from "@/lib/repositories/supabase/morphology-coverage-repository";
import type { Database } from "@/types/database";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

async function main(): Promise<void> {
  const datasetArgument = process.argv.find((argument) => argument.startsWith("--dataset="));
  const daysArgument = process.argv.find((argument) => argument.startsWith("--days="));
  const datasetVersion = z.string().trim().min(1).parse(datasetArgument?.slice("--dataset=".length));
  const days = z.coerce.number().int().positive().parse(daysArgument?.slice("--days=".length) ?? "14");
  loadMissingLocalEnvironment();
  const environment = z.object({ NEXT_PUBLIC_SUPABASE_URL: z.url(), SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1) }).parse(process.env);
  const vocabulary = JSON.parse(await readFile(resolve(process.cwd(), "data/vocabulary/production-catalog.json"), "utf8")) as ProductionVocabularyEntry[];
  const client = createClient<Database>(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  const persisted = await new SupabaseMorphologyCoverageRepository(client).load(datasetVersion);
  const confidenceByRoot = new Map(buildPersistedRootExpansionReport({ vocabulary, ...persisted }).roots.map((root) => [root.rootKey, root.pedagogicalConfidence]));
  const vocabularyById = new Map(vocabulary.map((word) => [word.id, word]));
  const candidates = persisted.records.flatMap((record) => {
    if (record.source !== "gold-dataset-exact-lemma" || record.confidence === "none" || record.reviewStatus === "rejected") return [];
    const word = vocabularyById.get(record.catalogWordId);
    if (!word) return [];
    return record.rootKeys.map((rootKey) => ({
      catalogWordId: record.catalogWordId,
      rootKey,
      familyKey: record.familyKey,
      frequencyRank: word.frequencyRank,
      frequencyBand: word.frequencyBand,
      coverageTags: word.coverageTags,
      learningValueScore: word.learningValueScore,
      confidence: record.confidence,
      reviewStatus: record.reviewStatus,
      rootPedagogicalConfidence: confidenceByRoot.get(rootKey) ?? null
    }));
  });
  console.log(JSON.stringify(simulateDaily30({ days, candidates }), null, 2));
}

function loadMissingLocalEnvironment(): void {
  try {
    for (const rawLine of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
      const line = rawLine.trim();
      const separator = line.indexOf("=");
      if (!line || line.startsWith("#") || separator < 1) continue;
      const key = line.slice(0, separator).trim();
      if (process.env[key] !== undefined) continue;
      const rawValue = line.slice(separator + 1).trim();
      process.env[key] = (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'")) ? rawValue.slice(1, -1) : rawValue;
    }
  } catch { /* explicit environment is sufficient */ }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
