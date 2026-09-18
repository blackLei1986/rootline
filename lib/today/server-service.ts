import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";
import { SupabaseLearnerRepository } from "@/lib/repositories/supabase/learner-repository";
import { SupabaseTodayRepository } from "@/lib/repositories/supabase/today-repository";
import { createTodayService, type TodayService } from "@/lib/today/service";
import { createTodayEventService } from "@/lib/today/events";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

let vocabularyCatalog: Promise<ProductionVocabularyEntry[]> | null = null;

export function createProductionTodayService(): TodayService {
  const client = createAdminSupabaseClient();
  const plans = new SupabaseTodayRepository(client);
  const learner = new SupabaseLearnerRepository(client);
  const feeds = new SupabaseFeedRepository(client);

  return createTodayService({
    plans,
    getLearnerSnapshot: (userId) => learner.getSnapshot(userId),
    getDailyVocabulary: () => loadProductionVocabulary(),
    getVocabularyEntries: async (wordIds) => {
      const wanted = new Set(wordIds);
      return (await loadProductionVocabulary()).filter((entry) => wanted.has(entry.id));
    },
    getArticleCandidates: (userId) => feeds.listCandidatesForUser(userId),
    getRecentArticleHistory: (userId) => feeds.listRecentArticleHistory(userId),
    getArticleBundle: (userId, articleId) => feeds.getTodayArticleBundle(userId, articleId),
    getReadingAvailability: (userId) => feeds.getTodayReadingAvailability(userId),
    reportDegradation: ({ userId, reason, availability }) => {
      console.info("Today Reading degraded", { userId, reason, availability });
    }
  });
}

export function createProductionTodayEventService() {
  return createTodayEventService(new SupabaseTodayRepository(createAdminSupabaseClient()));
}

async function loadProductionVocabulary(): Promise<ProductionVocabularyEntry[]> {
  vocabularyCatalog ??= readFile(
    resolve(process.cwd(), "data", "vocabulary", "production-catalog.json"),
    "utf8"
  ).then((source) => JSON.parse(source) as ProductionVocabularyEntry[]);
  return vocabularyCatalog;
}
