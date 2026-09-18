import "server-only";

import { recordArticleEncounter } from "@/lib/reading/encounters";
import { SupabaseLearnerRepository } from "@/lib/repositories/supabase/learner-repository";
import type { ArticleVocabularyMatch } from "@/types/articles";
import type { DatabaseClient } from "@/lib/repositories/supabase/shared";

export async function recordArticleBundleEncounters(input: {
  client: DatabaseClient;
  userId: string;
  articleId: string;
  sourceKey: string;
  lexicalMatches: ArticleVocabularyMatch[];
  operationPrefix: string;
  occurredAt: string;
}): Promise<void> {
  const store = new SupabaseLearnerRepository(input.client);
  await Promise.all(input.lexicalMatches.map((match) => recordArticleEncounter({
    userId: input.userId,
    wordId: match.wordId,
    articleId: input.articleId,
    sourceKey: input.sourceKey,
    occurrenceCount: Math.max(1, match.occurrences),
    occurredAt: input.occurredAt,
    operationId: `${input.operationPrefix}:${match.wordId}`
  }, store)));
}
