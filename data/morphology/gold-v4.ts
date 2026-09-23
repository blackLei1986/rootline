import type { GoldLexicalFamily, GoldRoot, GoldWord, RootProvenance } from "@/lib/morphology/types";

type Seed = {
  rootKey: string;
  familyKey: string;
  word: string;
  sourceWords: string[];
  evidenceNote: string;
};

const accessedAt = "2026-09-22" as const;

const seeds: Seed[] = [
  { rootKey: "graph", familyKey: "geographic", word: "geographic", sourceWords: ["geographic"], evidenceNote: "The cited history derives geographic from Greek geographikos, whose graph element is writing or description." },
  { rootKey: "phon", familyKey: "phonological", word: "phonological", sourceWords: ["phonological"], evidenceNote: "The cited history traces phonological through phonology to Greek phone, voice or sound." },
  { rootKey: "phon", familyKey: "headphone", word: "headphone", sourceWords: ["headphone", "telephone"], evidenceNote: "The headphone history forms the word from head plus an element extracted from telephone; the telephone history traces that phone element to Greek phone, voice or sound." },
  { rootKey: "micro", familyKey: "microscopic", word: "microscopic", sourceWords: ["microscopic"], evidenceNote: "The cited history identifies microscopic as a microscope derivative built on Greek mikros, small." },
  { rootKey: "micro", familyKey: "microbial", word: "microbial", sourceWords: ["microbial"], evidenceNote: "The cited history identifies microbial as a microbe derivative built on Greek mikros, small." }
];

function provenance(seed: Seed, sourceWord: string): RootProvenance {
  return {
    sourceTitle: "Online Etymology Dictionary",
    sourceUrl: `https://www.etymonline.com/word/${sourceWord}`,
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
  provenance: seed.sourceWords.map((sourceWord) => provenance(seed, sourceWord))
}));

export const goldV4RootAdditions: GoldRoot[] = [];
