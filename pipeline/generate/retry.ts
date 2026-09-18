import { PIPELINE_LIMITS } from "@/config/vocabulary-scoring";

export async function withRetry<T>(operation: () => Promise<T>, maxRetries = PIPELINE_LIMITS.maxRetries): Promise<{ value?: T; attempts: number; error?: string }> {
  let lastError = "Unknown generation error";
  for (let attempts = 1; attempts <= maxRetries; attempts += 1) {
    try { return { value: await operation(), attempts }; }
    catch (error) { lastError = error instanceof Error ? error.message : String(error); }
  }
  return { attempts: maxRetries, error: lastError };
}
