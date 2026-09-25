import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { createOwnedWordStateGetHandler } from "@/lib/sync/word-state-http";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { WordProgress } from "@/types/progress";

export const GET = createOwnedWordStateGetHandler({
  requireViewer: requireVerifiedViewerHttp,
  async getWordState(userId, wordId) {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.from("word_learning_states")
      .select("state")
      .eq("user_id", userId)
      .eq("word_id", wordId)
      .maybeSingle();
    if (error) throw error;
    return (data?.state as WordProgress | null) ?? null;
  }
});
