import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseLearnerRepository } from "@/lib/repositories/supabase/learner-repository";
import { SupabaseReadingRepository } from "@/lib/repositories/supabase/reading-repository";
import { SupabaseTodayRepository } from "@/lib/repositories/supabase/today-repository";

export async function createRepositories() {
  const client = await createServerSupabaseClient();
  return {
    learner: new SupabaseLearnerRepository(client),
    reading: new SupabaseReadingRepository(client),
    today: new SupabaseTodayRepository(client)
  };
}

export type {
  LearnerRepository,
  ReadingRepository,
  TodayRepository
} from "@/lib/repositories/contracts";
