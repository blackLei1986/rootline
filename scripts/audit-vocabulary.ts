import { generalEnglishCore } from "../data/course";
import { roots } from "../data/roots";
import { words } from "../data/words";
import type { FrequencyBand } from "../types/vocabulary";
import { phrases, sentences, wordFamilies } from "../data/learning-content";
import { expect, test } from "vitest";

const frequencyBands = new Set<FrequencyBand>(["very-high", "high", "medium", "low"]);
const rootIds = new Set(roots.map((root) => root.id));
const wordIds = new Set(words.map((word) => word.id));
const duplicateRoots = roots.filter((root, index) => roots.findIndex((item) => item.id === root.id) !== index).map((root) => root.id);
const duplicateWords = words.filter((word, index) => words.findIndex((item) => item.id === word.id) !== index).map((word) => word.id);
const invalidRootReferences = words.flatMap((word) => word.rootIds.filter((rootId) => !rootIds.has(rootId)).map((rootId) => `${word.id} -> ${rootId}`));
const invalidRelatedWords = words.flatMap((word) => word.relatedWords.filter((wordId) => !wordIds.has(wordId)).map((wordId) => `${word.id} -> ${wordId}`));
const invalidFamilies = words.filter((word) => !wordIds.has(word.wordFamilyId)).map((word) => `${word.id} -> ${word.wordFamilyId}`);
const missingScores = words.filter((word) => !Number.isFinite(word.learningValueScore)).map((word) => word.id);
const invalidFrequency = words.filter((word) => !frequencyBands.has(word.frequency.band)).map((word) => word.id);
const missingMasterFields = words.filter((word) => !word.vocabularyBand || !word.coverageTags.length || !Number.isFinite(word.priorityScore) || !word.sourceMetadata || !word.aiMetadata).map((word) => word.id);
const invalidExamScores = words.filter((word) => Object.values(word.examRelevance).some((score) => score < 0 || score > 100)).map((word) => word.id);
const brokenPhraseReferences = phrases.flatMap((phrase) => phrase.targetWordIds.filter((id) => !wordIds.has(id)).map((id) => `${phrase.id} -> ${id}`));
const brokenSentenceReferences = sentences.flatMap((sentence) => sentence.targetWordIds.filter((id) => !wordIds.has(id)).map((id) => `${sentence.id} -> ${id}`));
const lowConfidence = words.filter((word) => word.rootRelations.some((relation) => relation.confidence === "low"));
const missingFrequencySource = words.filter((word) => !word.frequency.source);
const missingCefr = words.filter((word) => !word.cefr);
const abnormalCoreCounts = roots.flatMap((root) => {
  const count = words.filter((word) => word.rootIds.includes(root.id) && word.rootTier === "core").length;
  return count < 4 || count > 8 ? [`${root.id}: ${count}`] : [];
});
const courseMissingRoots = generalEnglishCore.stages.flatMap((stage) => stage.rootIds.filter((rootId) => !rootIds.has(rootId)).map((rootId) => `${stage.id} -> ${rootId}`));
const brokenReferences = invalidRootReferences.length + invalidRelatedWords.length + invalidFamilies.length + courseMissingRoots.length;

console.log("Vocabulary Quality Report");
console.log(`Roots: ${roots.length}`);
console.log(`Surface words: ${words.length}`);
console.log(`Lemmas: ${new Set(words.map((word) => word.lemma)).size}`);
console.log(`Word families: ${wordFamilies.length}`);
console.log(`Phrases: ${phrases.length}`);
console.log(`Sentences: ${sentences.length}`);
console.log(`Broken references: ${brokenReferences}`);
console.log(`Duplicate root IDs: ${duplicateRoots.length}`);
console.log(`Duplicate word IDs: ${duplicateWords.length}`);
console.log(`Missing frequency source: ${missingFrequencySource.length}`);
console.log(`Missing CEFR: ${missingCefr.length}`);
console.log(`Low-confidence root relations: ${lowConfidence.length}`);
console.log(`Missing learningValueScore: ${missingScores.length}`);
console.log(`Invalid frequency: ${invalidFrequency.length}`);
console.log(`Missing master fields: ${missingMasterFields.length}`);
console.log(`Invalid exam relevance scores: ${invalidExamScores.length}`);
console.log(`Abnormal Core counts: ${abnormalCoreCounts.length}`);

const failures = [...invalidRootReferences, ...invalidRelatedWords, ...invalidFamilies, ...courseMissingRoots, ...brokenPhraseReferences, ...brokenSentenceReferences, ...duplicateRoots, ...duplicateWords, ...missingScores, ...invalidFrequency, ...missingMasterFields, ...invalidExamScores, ...abnormalCoreCounts];
if (failures.length) {
  console.error("Audit failures:");
  failures.forEach((failure) => console.error(`- ${failure}`));
}

test("vocabulary data passes the quality audit", () => {
  expect(failures).toEqual([]);
});
