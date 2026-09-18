import { z } from "zod";

const score = z.number().min(0).max(100);
const sourceReference = z.object({ name: z.string().min(1), version: z.string().optional(), url: z.string().url().optional(), note: z.string().optional() }).strict();
export const candidateSentenceSchema = z.object({
  text: z.string().min(8), translationZh: z.string().min(2), kind: z.enum(["simple", "common", "academic"]),
  naturalnessScore: score, utilityScore: score, difficultyScore: score
}).strict();
export const vocabularyCandidatePayloadSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), lemma: z.string().min(1), word: z.string().min(1), partOfSpeech: z.array(z.string().min(1)).min(1),
  coreMeaningZh: z.string().min(1), coreDefinitionEn: z.string().min(4),
  vocabularyBand: z.enum(["core-1000", "core-2000", "core-3000", "core-5000", "academic", "advanced"]),
  coverageTags: z.array(z.enum(["general", "academic", "ielts", "toefl"])).min(1),
  examRelevance: z.object({ ielts: score, toefl: score, academic: score, general: score }).strict(),
  morphology: z.string().min(1), rootIds: z.array(z.string()), collocations: z.array(z.string().min(3)).min(2).max(5),
  sentences: z.array(candidateSentenceSchema).min(3).max(5), family: z.array(z.string().min(1)).min(1), memoryHook: z.string().min(4),
  sourceMetadata: z.object({
    frequencySources: z.array(sourceReference), academicSources: z.array(sourceReference), examSources: z.array(sourceReference),
    generatedAt: z.string().min(8), generatedBy: z.string().min(1), reviewedAt: z.string().optional(), confidence: score
  }).strict(),
  aiMetadata: z.object({
    generated: z.boolean(), model: z.string().optional(), generatedAt: z.string().optional(), validationVersion: z.string().min(1),
    promptVersions: z.array(z.string()).optional(), confidence: score, needsReview: z.boolean()
  }).strict()
}).strict();

export type VocabularyCandidateInput = z.input<typeof vocabularyCandidatePayloadSchema>;
