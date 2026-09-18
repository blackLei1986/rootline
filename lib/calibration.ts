import { words as defaultWords } from "@/data/words";
import type { Word } from "@/types";
import type { CalibrationProfile, RecognitionState } from "@/types/progress";
import type { VocabularyBand } from "@/types/vocabulary";

export interface CalibrationAnswer {
  wordId: string;
  state: RecognitionState;
}

const bands: VocabularyBand[] = ["core-1000", "core-2000", "core-3000", "core-5000", "academic", "advanced"];

export function buildCalibrationSample(catalog: Word[] = defaultWords, size = 30): Word[] {
  const perBand = Math.max(1, Math.ceil(size / bands.length));
  const groups = bands.map((band) => catalog
    .filter((word) => word.vocabularyBand === band)
    .sort((a, b) => b.learningValueScore - a.learningValueScore)
    .slice(0, perBand));
  const sample: Word[] = [];
  for (let index = 0; sample.length < size; index += 1) {
    let added = false;
    for (const group of groups) {
      const word = group[index];
      if (word && sample.length < size) {
        sample.push(word);
        added = true;
      }
    }
    if (!added) break;
  }
  if (sample.length < size) {
    const selected = new Set(sample.map((word) => word.id));
    sample.push(...catalog.filter((word) => !selected.has(word.id)).sort((a, b) => b.learningValueScore - a.learningValueScore).slice(0, size - sample.length));
  }
  return sample;
}

export function calculateCalibrationResult(
  answers: CalibrationAnswer[],
  catalog: Word[] = defaultWords,
  now: Date = new Date()
): CalibrationProfile {
  const byId = new Map(catalog.map((word) => [word.id, word]));
  const knownCount = answers.filter((answer) => answer.state === "known").length;
  const fuzzyCount = answers.filter((answer) => answer.state === "fuzzy").length;
  const unknownCount = answers.filter((answer) => answer.state === "unknown").length;
  const weighted = answers.reduce((sum, answer) => {
    const word = byId.get(answer.wordId);
    const bandWeight = word ? bands.indexOf(word.vocabularyBand) + 1 : 1;
    const stateWeight = answer.state === "known" ? 1 : answer.state === "fuzzy" ? 0.45 : 0;
    return sum + bandWeight * stateWeight;
  }, 0);
  const maximum = answers.reduce((sum, answer) => {
    const word = byId.get(answer.wordId);
    return sum + (word ? bands.indexOf(word.vocabularyBand) + 1 : 1);
  }, 0);
  const ratio = maximum ? weighted / maximum : 0;
  const estimatedBand: VocabularyBand = ratio >= 0.82 ? "advanced"
    : ratio >= 0.68 ? "academic"
      : ratio >= 0.53 ? "core-5000"
        : ratio >= 0.38 ? "core-3000"
          : ratio >= 0.22 ? "core-2000"
            : "core-1000";
  return {
    completedAt: now.toISOString(),
    sampleSize: answers.length,
    knownCount,
    fuzzyCount,
    unknownCount,
    estimatedBand,
    confidence: Math.min(95, Math.round(45 + answers.length / 30 * 45))
  };
}
