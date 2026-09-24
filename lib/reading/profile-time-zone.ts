import { throwRepositoryError } from "@/lib/repositories/supabase/shared";

export function readRecommendationProfileTimeZone(result: {
  data: { timezone: string } | null;
  error: { code?: string; message?: string } | null;
}): string | null {
  throwRepositoryError(result.error, "load recommendation learning timezone");
  return result.data?.timezone ?? null;
}
