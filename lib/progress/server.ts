import "server-only";
import manifest from "@/data/vocabulary/production-manifest.json";
import { SupabaseProgressRepository } from "@/lib/repositories/supabase/progress-repository";
import { createProgressService } from "@/lib/progress/service";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { loadProductionVocabulary } from "@/lib/today/server-service";

export function createProductionProgressService() {
  const repository = new SupabaseProgressRepository(createAdminSupabaseClient());
  return createProgressService({repository, getCatalog: async () => ({
    ids: new Set((await loadProductionVocabulary()).map((entry) => entry.id)),
    version: manifest.version
  })});
}
