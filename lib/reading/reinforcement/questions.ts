import type { DailyReadingArticleWord } from "@/components/reading/daily-reading-article";
import type { SummaryToken } from "@/lib/reading/daily-reading-highlights";
import type { WordProgress } from "@/types/progress";
import type { FrozenQuestion, QuestionType } from "@/lib/reading/reinforcement/types";

export interface ReinforcementQuestionInput {
  articleId: string;
  summary: string;
  todayWordIds: string[];
  recentWordIds: string[];
  openedWordIds: string[];
  summaryTokens: SummaryToken[];
  words: DailyReadingArticleWord[];
  progressByWordId: Record<string, WordProgress>;
}

interface Occurrence { wordId: string; surface: string; start: number; }

const modes: QuestionType[] = ["recognition", "cloze", "recall"];

export function buildReinforcementQuestions(input: ReinforcementQuestionInput): FrozenQuestion[] {
  if (!input.summary.trim() || input.summaryTokens.map((token) => token.text).join("") !== input.summary) return [];
  const allowed = new Set([...input.todayWordIds, ...input.recentWordIds]);
  const wordById = new Map(input.words.filter((word) => allowed.has(word.wordId)).map((word) => [word.wordId, word]));
  const occurrences: Occurrence[] = [];
  let offset = 0;
  for (const token of input.summaryTokens) {
    if (token.wordId && wordById.has(token.wordId)) {
      occurrences.push({wordId: token.wordId, surface: token.text, start: offset});
    }
    offset += token.text.length;
  }
  const firstById = new Map<string, Occurrence>();
  for (const occurrence of occurrences) if (!firstById.has(occurrence.wordId)) firstById.set(occurrence.wordId, occurrence);
  const opened = new Set(input.openedWordIds);
  const today = new Set(input.todayWordIds);
  const candidates = [...firstById.values()].filter((item) => {
    const meaning = wordById.get(item.wordId)?.coreMeaningZh.trim();
    return Boolean(meaning && meaning.length <= 80 && contextFor(input.summary, item));
  }).sort((a, b) => {
    const priority = (item: Occurrence) => {
      if (today.has(item.wordId)) return 0;
      const progress = input.progressByWordId[item.wordId];
      if ((progress?.wrongCount ?? 0) > 0 || progress?.recognitionState === "fuzzy" || progress?.recognitionState === "unknown" || (progress?.nextReviewAt && new Date(progress.nextReviewAt).getTime() <= Date.now())) return 1;
      if (opened.has(item.wordId)) return 2;
      return 3;
    };
    return priority(a) - priority(b) || stableRank(`${input.articleId}:${a.wordId}`) - stableRank(`${input.articleId}:${b.wordId}`) || a.wordId.localeCompare(b.wordId);
  });

  const questions: FrozenQuestion[] = [];
  for (const occurrence of candidates) {
    if (questions.length >= 5) break;
    const word = wordById.get(occurrence.wordId)!;
    const originalContext = contextFor(input.summary, occurrence);
    if (!originalContext) continue;
    const preferred = modes[questions.length % modes.length]!;
    const fallback: QuestionType[] = preferred === "recognition" ? ["recognition", "cloze", "recall"]
      : preferred === "cloze" ? ["cloze", "recall", "recognition"] : ["recall", "cloze", "recognition"];
    const question = fallback.map((type) => makeQuestion(type, input, occurrence, word, originalContext, candidates, wordById))
      .find((item): item is FrozenQuestion => item !== null);
    if (question) questions.push(question);
  }
  return questions;
}

export function gradeReinforcementAnswer(question: FrozenQuestion, answer: string): boolean {
  const normalized = normalize(answer);
  return Boolean(normalized) && question.acceptedAnswers.some((accepted) => normalize(accepted) === normalized);
}

function makeQuestion(
  type: QuestionType, input: ReinforcementQuestionInput, occurrence: Occurrence,
  word: DailyReadingArticleWord, context: {text: string; localStart: number},
  candidates: Occurrence[], words: ReadonlyMap<string, DailyReadingArticleWord>
): FrozenQuestion | null {
  const base = {id: `${input.articleId}:${occurrence.wordId}`, wordId: occurrence.wordId, type};
  const meaning = word.coreMeaningZh.trim();
  if (type === "recognition") {
    const otherMeanings = [...new Set(candidates.filter((item) => item.wordId !== occurrence.wordId)
      .map((item) => words.get(item.wordId)?.coreMeaningZh.trim()).filter((value): value is string => Boolean(value && value !== meaning)))];
    if (otherMeanings.length < 2) return null;
    const choices = [meaning, ...otherMeanings.sort((a, b) => stableRank(`${input.articleId}:${occurrence.wordId}:${a}`) - stableRank(`${input.articleId}:${occurrence.wordId}:${b}`)).slice(0, 3)];
    choices.sort((a, b) => stableRank(`${input.articleId}:${occurrence.wordId}:choice:${a}`) - stableRank(`${input.articleId}:${occurrence.wordId}:choice:${b}`));
    return {...base, context: context.text, prompt: `结合这段摘要，选择 ${occurrence.surface} 的词库核心释义。`,
      choices, acceptedAnswers: [meaning], correctDisplay: meaning};
  }
  if (type === "cloze") {
    const source = context.text;
    const surface = source.slice(context.localStart, context.localStart + occurrence.surface.length);
    if (surface !== occurrence.surface || !/^[A-Za-z]+(?:['’][A-Za-z]+)*$/.test(surface)) return null;
    const masked = source.slice(0, context.localStart) + "____" + source.slice(context.localStart + surface.length);
    if (new RegExp(`\\b${escapeRegExp(surface)}\\b`, "iu").test(masked)) return null;
    return {...base, context: masked, prompt: "按摘要原句填入缺失的英文词形。",
      acceptedAnswers: [surface], correctDisplay: surface};
  }
  if (!/^[A-Za-z]+(?:['’][A-Za-z]+)*$/.test(word.lemma)) return null;
  return {...base, context: context.text, prompt: `根据词库释义“${meaning}”和摘要语境，写出英文原形。`,
    acceptedAnswers: [word.lemma], correctDisplay: word.lemma};
}

function contextFor(summary: string, occurrence: Occurrence): {text: string; localStart: number} | null {
  if (occurrence.start < 0 || summary.slice(occurrence.start, occurrence.start + occurrence.surface.length) !== occurrence.surface) return null;
  const before = summary.slice(0, occurrence.start);
  const lastBoundary = Math.max(before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("?"), before.lastIndexOf("\n"));
  const after = summary.slice(occurrence.start + occurrence.surface.length);
  const nextBoundary = after.search(/[.!?\n]/);
  const rawStart = lastBoundary + 1;
  const rawEnd = nextBoundary < 0 ? summary.length : occurrence.start + occurrence.surface.length + nextBoundary + 1;
  const raw = summary.slice(rawStart, rawEnd);
  const leading = raw.length - raw.trimStart().length;
  const text = raw.trim();
  if (text.length < occurrence.surface.length + 3 || text.length > 400) return null;
  return {text, localStart: occurrence.start - rawStart - leading};
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function stableRank(value: string): number {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
