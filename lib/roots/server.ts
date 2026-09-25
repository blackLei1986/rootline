import "server-only";
import {SupabaseProgressRepository} from "@/lib/repositories/supabase/progress-repository";
import {createAdminSupabaseClient} from "@/lib/supabase/admin";
import {loadProductionVocabulary} from "@/lib/today/server-service";
import {classifyProgressVocabulary} from "@/lib/progress/vocabulary";
import {buildTrustedRootDirectory} from "@/lib/roots/trusted-directory";

export async function loadTrustedRootDirectory(userId: string | null) {
  const repository = new SupabaseProgressRepository(createAdminSupabaseClient());
  const [links, vocabulary] = await Promise.all([repository.getTrustedRootLinks(), loadProductionVocabulary()]);
  const words = new Map(vocabulary.map((entry) => [entry.id, entry]));
  const trustedLinks = links.filter((link) => words.has(link.wordId));
  if (!userId) return {rows: buildTrustedRootDirectory(trustedLinks, new Map()), words, personal: false};
  const [snapshot, passiveWordIds] = await Promise.all([repository.getWordStates(userId), repository.getPassiveWordIds(userId)]);
  const categories = classifyProgressVocabulary(new Set(words.keys()), snapshot.states, passiveWordIds, new Date()).byWordId;
  return {rows: buildTrustedRootDirectory(trustedLinks, categories), words, personal: true};
}
