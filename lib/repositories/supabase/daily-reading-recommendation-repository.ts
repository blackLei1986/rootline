import type { DailyReadingRecommendationRepository } from "@/lib/repositories/contracts";
import { throwRepositoryError, toJson, type DatabaseClient } from "@/lib/repositories/supabase/shared";
import type { DailyReadingRecommendationResult } from "@/types/reading-recommendations";
import type { Json } from "@/types/database";

interface StoredRecommendationSet {
  algorithm_version: string;
  generated_at: string;
  recommendations: Json;
}

export class SupabaseDailyReadingRecommendationRepository implements DailyReadingRecommendationRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getSet(userId: string, learningDate: string): Promise<DailyReadingRecommendationResult | null> {
    const { data, error } = await this.client
      .from("daily_reading_recommendation_sets")
      .select("algorithm_version,generated_at,recommendations")
      .eq("user_id", userId)
      .eq("learning_date", learningDate)
      .maybeSingle();
    throwRepositoryError(error, "load daily reading recommendations");
    return data ? toResult(data) : null;
  }

  async saveFirstSet(
    userId: string,
    learningDate: string,
    result: DailyReadingRecommendationResult
  ): Promise<DailyReadingRecommendationResult> {
    if (result.recommendations.length === 0) {
      throw new Error("Cannot freeze an empty daily reading recommendation set.");
    }
    if (result.recommendations.length > 3) {
      throw new Error("A daily reading recommendation set cannot contain more than three items.");
    }

    const { error } = await this.client.from("daily_reading_recommendation_sets").upsert({
      user_id: userId,
      learning_date: learningDate,
      algorithm_version: result.algorithmVersion,
      generated_at: result.generatedAt,
      recommendations: toJson(result.recommendations)
    }, { onConflict: "user_id,learning_date", ignoreDuplicates: true });
    throwRepositoryError(error, "freeze daily reading recommendations");

    const stored = await this.getSet(userId, learningDate);
    if (!stored) throw new Error("Daily reading recommendation set was not persisted.");
    return stored;
  }
}

function toResult(row: StoredRecommendationSet): DailyReadingRecommendationResult {
  if (!Array.isArray(row.recommendations) || row.recommendations.length < 1 || row.recommendations.length > 3) {
    throw new Error("Stored daily reading recommendation set violates the 1–3 item contract.");
  }
  return {
    algorithmVersion: row.algorithm_version,
    generatedAt: row.generated_at,
    recommendations: row.recommendations as unknown as DailyReadingRecommendationResult["recommendations"]
  };
}
