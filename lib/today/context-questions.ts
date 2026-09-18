import type { ContextQuestion } from "@/types/context-question";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

interface ContextArticle {
  articleId: string;
  text: string;
}

interface ContextAnalysis {
  valuableUnknownWordIds: string[];
  lexicalMatches: Array<{ wordId: string }>;
}

export function buildContextQuestions(
  article: ContextArticle,
  analysis: ContextAnalysis,
  vocabulary: ProductionVocabularyEntry[],
  count: number
): ContextQuestion[] {
  if (count <= 0) return [];

  const entriesById = new Map(vocabulary.map((entry) => [entry.id, entry]));
  const targetIds = unique([
    ...analysis.valuableUnknownWordIds,
    ...analysis.lexicalMatches.map((match) => match.wordId)
  ]);
  const sentences = splitSentences(article.text);
  const questions: ContextQuestion[] = [];

  for (const targetId of targetIds) {
    if (questions.length >= count) break;
    const target = entriesById.get(targetId);
    if (!target) continue;

    const context = findContext(sentences, target);
    if (!context) continue;

    const distractors = deterministicDistractors(target, vocabulary, article.articleId, 3);
    if (distractors.length === 0) continue;

    const correctChoice = target.coreMeaningZh.trim();
    const choices = deterministicOrder(
      unique([correctChoice, ...distractors]),
      `${article.articleId}:${target.id}:choices`
    );

    questions.push({
      id: `context-${article.articleId}-${target.id}`,
      articleId: article.articleId,
      sentence: context,
      targetWordId: target.id,
      prompt: "根据文章语境，空格处单词最合适的含义是？",
      choices,
      correctChoice
    });
  }

  return questions;
}

function findContext(sentences: string[], target: ProductionVocabularyEntry): string | null {
  const forms = unique([target.word, target.lemma, ...target.surfaceForms])
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  for (const sentence of sentences) {
    for (const form of forms) {
      const pattern = new RegExp(`\\b${escapeRegExp(form)}\\b`, "iu");
      if (pattern.test(sentence)) return sentence.replace(pattern, "____");
    }
  }

  return null;
}

function deterministicDistractors(
  target: ProductionVocabularyEntry,
  vocabulary: ProductionVocabularyEntry[],
  articleId: string,
  count: number
): string[] {
  const correctChoice = target.coreMeaningZh.trim();
  const broadPartOfSpeech = target.partOfSpeech[0]?.toLowerCase() ?? "";
  const samePartOfSpeech = vocabulary.filter((entry) =>
    entry.id !== target.id &&
    entry.coreMeaningZh.trim() !== correctChoice &&
    (entry.partOfSpeech[0]?.toLowerCase() ?? "") === broadPartOfSpeech
  );
  const fallback = vocabulary.filter((entry) =>
    entry.id !== target.id &&
    entry.coreMeaningZh.trim() !== correctChoice &&
    !samePartOfSpeech.some((candidate) => candidate.id === entry.id)
  );

  return unique(
    deterministicOrder([...samePartOfSpeech, ...fallback], `${articleId}:${target.id}:distractors`)
      .map((entry) => entry.coreMeaningZh.trim())
      .filter(Boolean)
  ).slice(0, count);
}

function deterministicOrder<T extends string | ProductionVocabularyEntry>(items: T[], seed: string): T[] {
  return [...items].sort((left, right) => {
    const leftKey = typeof left === "string" ? left : left.id;
    const rightKey = typeof right === "string" ? right : right.id;
    return stableHash(`${seed}:${leftKey}`) - stableHash(`${seed}:${rightKey}`) || leftKey.localeCompare(rightKey);
  });
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
