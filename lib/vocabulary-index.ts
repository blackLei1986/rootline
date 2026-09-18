import { phrases, sentencePatterns, wordFamilies } from "@/data/learning-content";
import { words } from "@/data/words";
import type { Phrase, SentencePattern, Word, WordFamily } from "@/types";

export interface VocabularyIndex {
  wordById: Map<string, Word>;
  wordByLemma: Map<string, Word>;
  wordBySurfaceForm: Map<string, Word>;
  familyById: Map<string, WordFamily>;
  phraseByNormalizedText: Map<string, Phrase>;
  phrasesByFirstWord: Map<string, Phrase[]>;
  patterns: SentencePattern[];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'-]+/g, " ").trim();
}

export function createVocabularyIndex(): VocabularyIndex {
  const wordById = new Map<string, Word>();
  const wordByLemma = new Map<string, Word>();
  const wordBySurfaceForm = new Map<string, Word>();
  for (const word of words) {
    wordById.set(word.id, word);
    wordByLemma.set(normalize(word.lemma), word);
    for (const form of [word.word, word.lemma, ...word.family]) {
      wordBySurfaceForm.set(normalize(form), word);
    }
  }
  const phraseByNormalizedText = new Map<string, Phrase>();
  const phrasesByFirstWord = new Map<string, Phrase[]>();
  for (const phrase of phrases) {
    const text = normalize(phrase.text);
    phraseByNormalizedText.set(text, phrase);
    const first = text.split(" ")[0];
    phrasesByFirstWord.set(first, [...(phrasesByFirstWord.get(first) ?? []), phrase]);
  }
  for (const entries of phrasesByFirstWord.values()) {
    entries.sort((a, b) => b.text.split(/\s+/).length - a.text.split(/\s+/).length);
  }
  return {
    wordById,
    wordByLemma,
    wordBySurfaceForm,
    familyById: new Map(wordFamilies.map((family) => [family.headword, family])),
    phraseByNormalizedText,
    phrasesByFirstWord,
    patterns: sentencePatterns
  };
}

export const vocabularyIndex = createVocabularyIndex();
