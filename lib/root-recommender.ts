import { getRecommendedRoots } from "@/lib/course-engine";
import type { LearningStorage } from "@/types/progress";

export function recommendNextRoot(storage: LearningStorage) {
  return getRecommendedRoots(storage, 1)[0];
}
