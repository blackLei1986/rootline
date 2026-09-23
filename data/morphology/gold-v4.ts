import type { GoldLexicalFamily, GoldRoot, GoldWord, RootProvenance } from "@/lib/morphology/types";

type Seed = {
  rootKey: string;
  familyKey: string;
  word: string;
  sourceWord: string;
  evidenceNote: string;
};

const accessedAt = "2026-09-22" as const;

const seeds: Seed[] = [
  { rootKey: "graph", familyKey: "geographic", word: "geographic", sourceWord: "geographic", evidenceNote: "The cited history derives geographic from Greek geographikos, whose graph element is writing or description." },
  { rootKey: "phon", familyKey: "phonological", word: "phonological", sourceWord: "phonological", evidenceNote: "The cited history traces phonological through phonology to Greek phone, voice or sound." },
  { rootKey: "phon", familyKey: "headphone", word: "headphone", sourceWord: "headphone", evidenceNote: "The cited history identifies headphone as a compound built on phone, from Greek phone, voice or sound." },
  { rootKey: "micro", familyKey: "microscopic", word: "microscopic", sourceWord: "microscopic", evidenceNote: "The cited history identifies microscopic as a microscope derivative built on Greek mikros, small." },
  { rootKey: "micro", familyKey: "microbial", word: "microbial", sourceWord: "microbial", evidenceNote: "The cited history identifies microbial as a microbe derivative built on Greek mikros, small." }
];

function provenance(seed: Seed): RootProvenance {
  return {
    sourceTitle: "Online Etymology Dictionary",
    sourceUrl: `https://www.etymonline.com/word/${seed.sourceWord}`,
    accessedAt,
    evidenceNote: seed.evidenceNote
  };
}

function family(seed: Seed): GoldLexicalFamily {
  return {
    key: `${seed.rootKey}:${seed.familyKey}`,
    displayName: `${seed.familyKey} family`,
    formationExplanation: `Explicitly sourced ${seed.rootKey} teaching family: ${seed.familyKey}.`
  };
}

export const goldV4WordAdditions: GoldWord[] = seeds.map((seed) => ({
  wordId: `v4:${seed.word}`,
  word: seed.word,
  lemma: seed.word,
  rootIds: [seed.rootKey],
  morphology: `${seed.rootKey} teaching relation in ${seed.word}`,
  formationExplanation: seed.evidenceNote,
  teachingFamily: [family(seed).displayName],
  lexicalFamily: family(seed),
  provenance: [provenance(seed)]
}));

export const goldV4RootAdditions: GoldRoot[] = [];
