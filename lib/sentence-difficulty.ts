import type { Sentence, Word } from "@/types";

const tokenize = (text: string) => text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];

export function calculateSentenceKnownWordRatio(text: string, knownWords: Set<string>): number {
  const tokens = tokenize(text);
  if (!tokens.length) return 1;
  const known = tokens.filter((token) => knownWords.has(token)).length;
  return Math.round(known / tokens.length * 100) / 100;
}

export function estimateSentenceDifficulty(text: string, catalog: Word[]): number {
  const tokens = tokenize(text);
  if (!tokens.length) return 0;
  const index = new Map(catalog.flatMap((word) => [[word.word.toLowerCase(), word], [word.lemma.toLowerCase(), word]] as const));
  const wordDifficulty = tokens.reduce((sum, token) => {
    const word = index.get(token);
    return sum + (word ? word.staticDifficulty : 58);
  }, 0) / tokens.length;
  const lengthPenalty = Math.min(24, Math.max(0, tokens.length - 8) * 1.5);
  const clausePenalty = Math.min(12, (text.match(/[,;:]/g)?.length ?? 0) * 4);
  return Math.max(0, Math.min(100, Math.round(wordDifficulty * 0.72 + lengthPenalty + clausePenalty)));
}

export function isSentenceReadyForLearner(sentence: Sentence, knownWords: Set<string>, minimumRatio = 0.8): boolean {
  return sentence.qualityScore >= 78 && calculateSentenceKnownWordRatio(sentence.text, knownWords) >= minimumRatio;
}
