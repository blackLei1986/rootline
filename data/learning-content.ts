import { words } from "@/data/words";
import type { Phrase, Sentence, SentencePattern, WordFamily } from "@/types";

const significantPhraseMeanings = ["显著差异", "重大影响", "显著增加", "具有统计显著性"];

export const phrases: Phrase[] = words.flatMap((word) => word.collocations.map((text, index) => ({
  id: `phrase-${word.id}-${index + 1}`,
  text,
  meaningZh: word.id === "significant" ? significantPhraseMeanings[index] : `${word.meaningZh[0]}的常用搭配`,
  type: text.split(" ").length > 2 ? "fixed-expression" as const : "collocation" as const,
  frequency: word.frequency.band,
  targetWordIds: [word.id],
  exampleSentenceIds: word.sentenceIds,
  difficulty: word.staticDifficulty,
  coverageTags: word.coverageTags,
  qualityScore: word.id === "significant" ? 94 : 78,
  status: "accepted" as const
})));

export const sentences: Sentence[] = words.flatMap((word) => word.examples.map((example, index) => {
  const isPilot = word.id === "significant";
  const quality = isPilot ? [94, 96, 95][index] ?? 92 : 80;
  return {
    id: `sentence-${word.id}-${index + 1}`,
    text: example.en,
    translationZh: example.zh,
    level: word.cefr ?? (word.frequency.band === "very-high" ? "A2" : word.frequency.band === "high" ? "B1" : "B2"),
    frequencyBand: word.frequency.band,
    topic: index === 2 ? "academic" : "general",
    pattern: word.id === "significant" && index === 1 ? "have a significant impact on..." : undefined,
    targetWordIds: [word.id],
    targetPhraseIds: word.phraseIds,
    difficulty: Math.min(100, word.staticDifficulty + index * 8),
    sourceType: "editorial" as const,
    aiGenerated: false,
    naturalnessScore: quality,
    utilityScore: quality,
    difficultyScore: Math.max(70, quality - 3),
    qualityScore: quality,
    status: "accepted" as const
  };
}));

export const sentencePatterns: SentencePattern[] = [
  { id: "pattern-no-doubt", pattern: "There is no doubt that...", meaningZh: "毫无疑问……", usage: "用于引出确定的判断。", exampleSentenceIds: [], level: "B2", tags: ["general", "academic", "ielts", "toefl"] },
  { id: "pattern-important-note", pattern: "It is important to note that...", meaningZh: "需要注意的是……", usage: "在学术和说明性文本中引出重要信息。", exampleSentenceIds: [], level: "B2", tags: ["academic", "ielts", "toefl"] },
  { id: "pattern-role", pattern: "play an important role in...", meaningZh: "在……中发挥重要作用", usage: "描述某因素的功能或影响。", exampleSentenceIds: [], level: "B1", tags: ["general", "academic", "ielts", "toefl"] },
  { id: "pattern-associated", pattern: "be associated with...", meaningZh: "与……有关", usage: "描述相关性，不直接表示因果。", exampleSentenceIds: [], level: "B2", tags: ["academic", "ielts", "toefl"] },
  { id: "pattern-lead-to", pattern: "lead to...", meaningZh: "导致……", usage: "表达原因与结果的常用结构。", exampleSentenceIds: [], level: "B1", tags: ["general", "academic", "ielts", "toefl"] }
];

export const wordFamilies: WordFamily[] = [...new Set(words.map((word) => word.wordFamilyId))].map((familyId) => {
  const members = words.filter((word) => word.wordFamilyId === familyId);
  return {
    id: `${familyId}-family`,
    headword: familyId,
    memberIds: members.map((word) => word.id),
    lemmaCount: new Set(members.map((word) => word.lemma)).size,
    surfaceWordCount: members.length,
    coverageTags: [...new Set(members.flatMap((word) => word.coverageTags))]
  };
});

export const getPhrasesByWord = (wordId: string) => phrases.filter((phrase) => phrase.targetWordIds.includes(wordId));
export const getSentencesByWord = (wordId: string) => sentences.filter((sentence) => sentence.targetWordIds.includes(wordId));
export const getWordFamily = (wordFamilyId: string) => wordFamilies.find((family) => family.headword === wordFamilyId);
