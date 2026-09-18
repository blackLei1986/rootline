import { phrases, sentencePatterns } from "@/data/learning-content";
import { vocabularyIndex } from "@/lib/vocabulary-index";
import { calculateReadingCoverage } from "@/lib/reading/coverage";
import { getReadingKnowledgeState } from "@/lib/reading/knowledge";
import { lemmatize } from "@/lib/reading/lemmatize";
import { scoreRecommendation } from "@/lib/reading/recommendation";
import { splitSentences, tokenize } from "@/lib/reading/tokenize";
import type { LearningStorage } from "@/types/progress";
import type { ReadingDocument, ReadingPatternMatch, ReadingPhraseMatch, ReadingSourceType, ReadingTokenMatch, ReadingVocabularyItem } from "@/types/reading";

export const READING_ANALYSIS_VERSION = "1.0.0";
export const MAX_READING_WORDS = 15_000;

const FUNCTION_WORDS = new Set("a an the and or but if because as at by for from in into of on onto to with without about above below between through during before after is am are was were be been being have has had do does did can could may might must shall should will would this that these those it its they them their he him his she her we us our you your who whom whose which what where when why how not no nor so than then there here also very more most some any each every both either neither many much few little one two first second such own same other another all".split(" "));

function isLikelyProperNoun(token: string, isSentenceStart: boolean, matched: boolean): boolean {
  if (matched || isSentenceStart) return false;
  return /^[A-Z][a-z]+(?:-[A-Z][a-z]+)?$/.test(token) || /^[A-Z]{2,}$/.test(token);
}

function matchPhrases(tokens: ReadingTokenMatch[]): ReadingPhraseMatch[] {
  const matches: ReadingPhraseMatch[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const candidates = vocabularyIndex.phrasesByFirstWord.get(tokens[index].normalized) ?? [];
    const phrase = candidates.find((candidate) => {
      const parts = candidate.text.toLowerCase().split(/\s+/);
      return parts.every((part, offset) => tokens[index + offset]?.normalized === part);
    });
    if (!phrase) continue;
    const length = phrase.text.split(/\s+/).length;
    matches.push({ phraseId: phrase.id, text: phrase.text, startTokenIndex: index, endTokenIndex: index + length - 1, sentenceIndex: tokens[index].sentenceIndex });
    index += length - 1;
  }
  return matches;
}

function matchPatterns(sentences: string[]): ReadingPatternMatch[] {
  const normalizePattern = (value: string) => value.toLowerCase().replace(/\.\.\.$/, "").replace(/[xy]/g, "").replace(/\s+/g, " ").trim();
  return sentences.flatMap((sentence, sentenceIndex) => sentencePatterns.flatMap((pattern) => {
    const needle = normalizePattern(pattern.pattern);
    return needle.length >= 5 && sentence.toLowerCase().includes(needle) ? [{ patternId: pattern.id, text: pattern.pattern, sentenceIndex }] : [];
  }));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export interface AnalyzeReadingInput {
  text: string;
  title?: string;
  sourceType: ReadingSourceType;
  storage: LearningStorage;
  id?: string;
  now?: Date;
}

export function analyzeReadingDocument({ text, title, sourceType, storage, id, now = new Date() }: AnalyzeReadingInput): ReadingDocument {
  const rawTokens = tokenize(text);
  if (!rawTokens.length) throw new Error("请粘贴包含英文单词的文章。");
  if (rawTokens.length > MAX_READING_WORDS) throw new Error(`文章超过 ${MAX_READING_WORDS.toLocaleString()} 词，请分段分析。`);
  const sentences = splitSentences(text);
  const tokens: ReadingTokenMatch[] = rawTokens.map((raw, index) => {
    if (raw.isNumber) return { id: `token-${index}`, ...raw, status: "number", knowledgeState: "untracked", isContentWord: false };
    const lemma = lemmatize(raw.normalized, vocabularyIndex);
    const word = vocabularyIndex.wordBySurfaceForm.get(raw.normalized) ?? vocabularyIndex.wordByLemma.get(lemma);
    if (isLikelyProperNoun(raw.token, raw.isSentenceStart, Boolean(word))) {
      return { id: `token-${index}`, ...raw, lemma, status: "proper-noun", knowledgeState: "untracked", isContentWord: false };
    }
    if (!word) return { id: `token-${index}`, ...raw, lemma, status: "unknown", knowledgeState: "untracked", isContentWord: !FUNCTION_WORDS.has(lemma) };
    return {
      id: `token-${index}`,
      ...raw,
      lemma: word.lemma,
      wordId: word.id,
      familyId: word.wordFamilyId,
      status: "matched",
      knowledgeState: getReadingKnowledgeState(word.id, storage),
      isContentWord: !FUNCTION_WORDS.has(word.lemma)
    };
  });
  const coverage = calculateReadingCoverage(tokens);
  const byWord = new Map<string, ReadingTokenMatch[]>();
  for (const token of tokens) {
    if (token.wordId && token.isContentWord) byWord.set(token.wordId, [...(byWord.get(token.wordId) ?? []), token]);
  }
  const titleLower = title?.toLowerCase() ?? "";
  const analysisPath = sourceType === "toefl" || sourceType === "ielts" || sourceType === "academic" ? sourceType : storage.settings.learningGoal.path;
  const vocabulary: ReadingVocabularyItem[] = [...byWord.entries()].map(([wordId, occurrences]) => {
    const word = vocabularyIndex.wordById.get(wordId)!;
    const first = occurrences[0];
    const recommendation = scoreRecommendation({ word, state: first.knowledgeState, occurrences: occurrences.length, inTitle: titleLower.includes(word.word.toLowerCase()), sentenceIndex: first.sentenceIndex, path: analysisPath });
    return {
      wordId,
      lemma: word.lemma,
      familyId: word.wordFamilyId,
      knowledgeState: first.knowledgeState,
      occurrences: occurrences.length,
      occurrenceTokenIds: occurrences.map((token) => token.id),
      contextSentence: sentences[first.sentenceIndex] ?? "",
      contextImportance: recommendation.contextImportance,
      recommendationScore: recommendation.score,
      recommendation: recommendation.band,
      canInfer: recommendation.canInfer
    };
  }).sort((a, b) => b.recommendationScore - a.recommendationScore || b.occurrences - a.occurrences);
  const contentTokens = tokens.filter((token) => token.isContentWord);
  const unmatchedContent = contentTokens.filter((token) => token.status === "unknown").length;
  const knowledgeGap = coverage.unknownContentWords + coverage.fuzzyContentWords + coverage.untrackedContentWords * 0.55;
  const unknownDensity = Math.round((knowledgeGap / Math.max(1, contentTokens.length)) * 10_000) / 100;
  const averageSentenceLength = rawTokens.length / Math.max(1, sentences.length);
  const academicCount = tokens.filter((token) => token.wordId && vocabularyIndex.wordById.get(token.wordId)?.coverageTags.includes("academic")).length;
  const academicVocabularyRatio = Math.round((academicCount / Math.max(1, contentTokens.length)) * 1000) / 10;
  const documentDifficulty = clamp(averageSentenceLength * 1.6 + academicVocabularyRatio * 0.7 + unmatchedContent / Math.max(1, contentTokens.length) * 35);
  const userDifficulty = clamp(documentDifficulty * 0.45 + (100 - coverage.contentWordCoverage) * 0.55);
  const difficultyLabel = userDifficulty < 30 ? "easy" : userDifficulty < 52 ? "comfortable" : userDifficulty < 74 ? "challenging" : "hard";
  return {
    id: id ?? `reading-${now.getTime()}`,
    title: title?.trim() || undefined,
    text,
    sourceType,
    createdAt: now.toISOString(),
    wordCount: rawTokens.length,
    uniqueLemmaCount: new Set(tokens.map((token) => token.lemma).filter(Boolean)).size,
    documentDifficulty,
    userDifficulty,
    difficultyLabel,
    coverage,
    unknownDensity,
    academicVocabularyRatio,
    tokens,
    vocabulary,
    phrases: matchPhrases(tokens),
    patterns: matchPatterns(sentences),
    sentences,
    analysisVersion: READING_ANALYSIS_VERSION
  };
}

export function scoreDocumentForUser(document: ReadingDocument): "too-easy" | "comfortable" | "challenge" | "too-hard" {
  if (document.coverage.contentWordCoverage >= 98 || document.userDifficulty < 24) return "too-easy";
  if (document.coverage.contentWordCoverage >= 94 && document.userDifficulty < 50) return "comfortable";
  if (document.coverage.contentWordCoverage >= 86 && document.userDifficulty < 75) return "challenge";
  return "too-hard";
}

export const readingPhraseCatalogSize = phrases.length;
