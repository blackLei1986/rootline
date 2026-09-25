import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { words } from "@/data/words";
import { buildMorphologyCoverageReport } from "@/lib/morphology/audit";
import { buildPersistedMorphologyCoverageReport } from "@/lib/morphology/coverage-service";
import { SupabaseMorphologyCoverageRepository } from "@/lib/repositories/supabase/morphology-coverage-repository";
import type { Database } from "@/types/database";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

const catalogPath = resolve(process.cwd(), "data/vocabulary/production-catalog.json");

async function main() {
  const vocabulary = JSON.parse(await readFile(catalogPath, "utf8")) as ProductionVocabularyEntry[];
  const modeArgument = process.argv.find((argument) => argument.startsWith("--mode="));
  const mode = z.enum(["dry-run", "persisted"]).parse(modeArgument?.slice("--mode=".length) ?? "dry-run");

  if (mode === "dry-run") {
    const report = buildMorphologyCoverageReport({ vocabulary, curatedWords: words });
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const datasetArgument = process.argv.find((argument) => argument.startsWith("--dataset="));
  const datasetVersion = z.string().trim().min(1).parse(datasetArgument?.slice("--dataset=".length) ?? "gold-v1");
  loadMissingLocalEnvironment();
  const environment = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1)
  }).parse(process.env);
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } }
  );
  const persisted = await new SupabaseMorphologyCoverageRepository(client).load(datasetVersion);
  const report = buildPersistedMorphologyCoverageReport({ vocabulary, ...persisted });

  console.log(JSON.stringify(report, null, 2));
}

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

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
