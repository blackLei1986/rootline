import { VALIDATION_VERSION } from "@/config/vocabulary-scoring";
import type { VocabularyCandidatePayload } from "@/pipeline/types";

export const significantCandidate: VocabularyCandidatePayload = {
  id: "significant", lemma: "significant", word: "significant", partOfSpeech: ["adjective"],
  coreMeaningZh: "重要的；显著的", coreDefinitionEn: "important or large enough to be noticed", vocabularyBand: "core-3000",
  coverageTags: ["general", "academic", "ielts", "toefl"], examRelevance: { general: 88, academic: 94, ielts: 91, toefl: 90 },
  morphology: "signific + ant", rootIds: [],
  collocations: ["significant difference", "significant impact", "significant increase", "statistically significant"],
  sentences: [
    { text: "There was a significant change.", translationZh: "发生了显著变化。", kind: "simple", naturalnessScore: 94, utilityScore: 92, difficultyScore: 35 },
    { text: "The new policy had a significant impact on the industry.", translationZh: "新政策对该行业产生了重大影响。", kind: "common", naturalnessScore: 96, utilityScore: 96, difficultyScore: 58 },
    { text: "The study found a significant relationship between sleep duration and academic performance.", translationZh: "研究发现睡眠时长与学业表现之间存在显著关联。", kind: "academic", naturalnessScore: 95, utilityScore: 94, difficultyScore: 72 }
  ],
  family: ["significant", "significance", "significantly"], memoryHook: "significance 是‘重要性’，significant 就是重要到值得注意。",
  sourceMetadata: {
    frequencySources: [{ name: "Rootline editorial pilot", version: "2026.09" }], academicSources: [{ name: "Rootline editorial pilot", version: "2026.09" }], examSources: [],
    generatedAt: "2026-09-17", generatedBy: "fixture-provider-v1", reviewedAt: "2026-09-17", confidence: 88
  },
  aiMetadata: { generated: true, model: "fixture-provider-v1", generatedAt: "2026-09-17", validationVersion: VALIDATION_VERSION, promptVersions: ["vocabulary-enrichment.v1", "sentence-generation.v1", "collocation-generation.v1", "quiz-generation.v1"], confidence: 88, needsReview: false }
};
