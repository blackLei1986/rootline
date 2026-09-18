import { wordFamilies } from "@/data/learning-content";
import { words } from "@/data/words";
import type { LearningStorage } from "@/types/progress";
import type { CoverageTag, MasterVocabularyStats, VocabularyBand } from "@/types/vocabulary";

export const VOCABULARY_BAND_ORDER: VocabularyBand[] = ["core-1000", "core-2000", "core-3000", "core-5000", "academic", "advanced"];

export function getMasterVocabularyStats(): MasterVocabularyStats {
  return { lemmaCount: new Set(words.map((word) => word.lemma)).size, acceptedLemmaCount: new Set(words.filter((word) => word.pipelineStatus === "accepted").map((word) => word.lemma)).size, surfaceWordCount: words.length, familyCount: wordFamilies.length };
}

export function getMasteredWordIds(storage: LearningStorage): Set<string> {
  return new Set(Object.values(storage.words).filter((progress) => progress.status === "mastered").map((progress) => progress.wordId));
}

export function getCoverage(storage: LearningStorage, filter: { band?: VocabularyBand; tag?: CoverageTag }) {
  const catalog = words.filter((word) => (!filter.band || word.vocabularyBand === filter.band) && (!filter.tag || word.coverageTags.includes(filter.tag)));
  const mastered = getMasteredWordIds(storage);
  const masteredCount = catalog.filter((word) => mastered.has(word.id)).length;
  return { total: catalog.length, mastered: masteredCount, percent: catalog.length ? Math.round(masteredCount / catalog.length * 100) : 0 };
}
