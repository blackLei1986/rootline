import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createGoldDatasetV1 } from "@/lib/morphology/gold-dataset";
import { parseMorphologyImportArgs } from "@/lib/morphology/import-cli";
import { MorphologyImportService } from "@/lib/morphology/import-runner";
import { SupabaseMorphologyImportRepository } from "@/lib/repositories/supabase/morphology-import-repository";
import type { Database } from "@/types/database";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

const cliEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1)
});

function loadMissingLocalEnvironment(): void {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      if (process.env[key] !== undefined) continue;
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // Explicit process environment is sufficient for CI and local Supabase.
  }
}

async function main(): Promise<void> {
  const args = parseMorphologyImportArgs(process.argv.slice(2));
  loadMissingLocalEnvironment();
  const environment = cliEnvironmentSchema.parse(process.env);
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } }
  );
  const repository = new SupabaseMorphologyImportRepository(client);
  const service = new MorphologyImportService(repository);
  const vocabulary = JSON.parse(
    await readFile(resolve(process.cwd(), "data/vocabulary/production-catalog.json"), "utf8")
  ) as ProductionVocabularyEntry[];
  const dataset = createGoldDatasetV1();
  if (dataset.version !== args.datasetVersion) {
    throw new Error(`Dataset source mismatch: expected ${args.datasetVersion}, received ${dataset.version}.`);
  }

  const plan = await service.buildPlan({ dataset, vocabulary });
  if (args.mode === "dry-run") {
    console.log(JSON.stringify({ mode: args.mode, datasetVersion: dataset.version, ...plan.summary, errors: plan.errors }, null, 2));
    if (plan.errors.length > 0) process.exitCode = 1;
    return;
  }

  const result = await service.applyPlan(plan, "rootline-morphology-importer");
  console.log(JSON.stringify({ mode: args.mode, dataset: dataset.version, plan: plan.summary, result }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
