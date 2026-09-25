import { lemmatize } from "@/lib/reading/lemmatize";
import type { VocabularyIndex } from "@/lib/vocabulary-index";

export type HighlightLevel = "today" | "recent-7-day" | "recent-legacy";
export interface DailyReadingHighlightMatch {
  wordId: string;
  lemma: string;
  surfaceForms?: string[];
  level: HighlightLevel;
}
export interface DailyReadingKnownVocabularyEntry { lemma: string; surfaceForms: readonly string[] }
export interface SummaryToken {
  text: string;
  wordId?: string;
  level?: HighlightLevel;
}

const levelPriority: Record<HighlightLevel, number> = { today: 3, "recent-7-day": 2, "recent-legacy": 1 };

export function buildSummaryTokens(summary: string, matches: readonly DailyReadingHighlightMatch[], knownVocabulary: readonly DailyReadingKnownVocabularyEntry[]): SummaryToken[] {
  const matchByForm = new Map<string, DailyReadingHighlightMatch>();
  for (const match of matches) {
    for (const form of [match.lemma, ...(match.surfaceForms ?? [])]) {
      const key = normalize(form);
      const existing = matchByForm.get(key);
      if (!existing || levelPriority[match.level] > levelPriority[existing.level]) matchByForm.set(key, match);
    }
  }
  const index = makeLemmatizerIndex(matchByForm, knownVocabulary);
  const tokens: SummaryToken[] = [];
  const wordPattern = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
  let cursor = 0;
  for (const found of summary.matchAll(wordPattern)) {
    const text = found[0];
    const start = found.index;
    if (start === undefined) continue;
    const normalized = normalize(text);
    const match = matchByForm.get(normalized) ?? matchByForm.get(normalize(lemmatize(normalized, index)));
    if (!match) continue;
    if (start > cursor) tokens.push({ text: summary.slice(cursor, start) });
    tokens.push({ text, wordId: match.wordId, level: match.level });
    cursor = start + text.length;
  }
  if (cursor < summary.length) tokens.push({ text: summary.slice(cursor) });
  if (tokens.length === 0 && summary.length > 0) tokens.push({ text: summary });
  return tokens;
}

export function getHighlightLabel(level: HighlightLevel): string {
  if (level === "today") return "今日词";
  return level === "recent-7-day" ? "近 7 日词" : "近期词";
}

function makeLemmatizerIndex(matches: ReadonlyMap<string, DailyReadingHighlightMatch>, knownVocabulary: readonly DailyReadingKnownVocabularyEntry[]): VocabularyIndex {
  const wordByLemma = new Map<string, { lemma: string; id: string }>();
  const wordBySurfaceForm = new Map<string, { lemma: string; id: string }>();
  for (const entry of knownVocabulary) {
    const lemma = normalize(entry.lemma);
    wordByLemma.set(lemma, { lemma, id: lemma });
    for (const form of entry.surfaceForms) wordBySurfaceForm.set(normalize(form), { lemma, id: lemma });
  }
  for (const [form, match] of matches) {
    const lemma = normalize(match.lemma);
    wordByLemma.set(lemma, { lemma, id: match.wordId });
    wordBySurfaceForm.set(form, { lemma, id: match.wordId });
  }
  return { wordByLemma, wordBySurfaceForm } as unknown as VocabularyIndex;
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().replace(/[’]/g, "'").toLocaleLowerCase("en-US");
}
