import type { NormalizedFeedEntry } from "@/types/feeds";
import type { MetadataAnalysis } from "@/types/articles";

export function analyzeArticleMetadata(entry: NormalizedFeedEntry): MetadataAnalysis {
  const sample = `${entry.title} ${entry.summary}`.trim();
  const words = sample.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) ?? [];
  const letters = sample.match(/\p{L}/gu) ?? [];
  const latin = sample.match(/[A-Za-z]/g)?.length ?? 0;
  const likelyLanguage = letters.length > 0 && latin / letters.length >= 0.75 ? "en" : "und";
  const topicTerms = [...new Set(words.map((word) => word.toLowerCase()).filter((word) => word.length >= 6))]
    .slice(0, 12);
  const eligible = likelyLanguage === "en" && Boolean(entry.url) && Boolean(entry.title);
  return {
    estimatedMinutes: Math.max(3, Math.min(12, Math.ceil(Math.max(600, words.length * 8) / 220))),
    likelyLanguage,
    topicTerms,
    eligible,
    rejectionReason: eligible ? null : "unsupported-language-or-missing-metadata"
  };
}
