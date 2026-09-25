import type { GoldLexicalFamily, GoldWord } from "@/lib/morphology/types";

type Seed = {
  rootKey: string;
  familyKey: string;
  word: string;
  sourceWord: string;
  evidenceNote: string;
  familyDisplayName?: string;
  familyExplanation?: string;
};

const seeds: Seed[] = [
  { rootKey: "cess", familyKey: "cessation", word: "cessation", sourceWord: "cessation", evidenceNote: "The cited history traces cessation to Latin cessare and PIE *ked- ‘go, yield’, supporting the established cess root teaching relation." },
  { rootKey: "graph", familyKey: "choreograph", word: "choreograph", sourceWord: "choreograph", evidenceNote: "The cited history derives choreography from Greek khoreia ‘dance’ plus graphein ‘write’; choreograph is its back-formation." },
  { rootKey: "ject", familyKey: "conjecture", word: "conjecture", sourceWord: "conjecture", evidenceNote: "The cited history derives conjecture from Latin conicere ‘throw together’, from com- plus iacere ‘throw’, the ject root family." },
  { rootKey: "centr", familyKey: "eccentric", word: "eccentricity", sourceWord: "eccentric", evidenceNote: "The cited history derives eccentric from Greek ekkentros ‘out of the center’ and lists eccentricity as its derivative, supporting centr ‘center’.", familyDisplayName: "eccentric family", familyExplanation: "centr teaching family: eccentric family." },
  { rootKey: "graph", familyKey: "iconography", word: "iconography", sourceWord: "iconography", evidenceNote: "The cited history derives iconography from Greek eikonographia and identifies -graphia from graphein ‘write, draw’, supporting graph ‘write/draw’." },
];

function lexicalFamily(seed: Seed): GoldLexicalFamily {
  return {
    key: `${seed.rootKey}:${seed.familyKey}`,
    displayName: seed.familyDisplayName ?? `${seed.familyKey} family`,
    formationExplanation: seed.familyExplanation ?? `Explicitly sourced ${seed.rootKey} teaching family: ${seed.familyKey}.`
  };
}

export const goldV5WordAdditions: GoldWord[] = seeds.map((seed) => ({
  wordId: `v5:${seed.word}`,
  word: seed.word,
  lemma: seed.word,
  rootIds: [seed.rootKey],
  morphology: `${seed.rootKey} teaching relation in ${seed.word}`,
  formationExplanation: seed.evidenceNote,
  teachingFamily: [lexicalFamily(seed).displayName],
  lexicalFamily: lexicalFamily(seed),
  provenance: [{
    sourceTitle: "Online Etymology Dictionary",
    sourceUrl: `https://www.etymonline.com/word/${seed.sourceWord}`,
    accessedAt: "2026-09-23",
    evidenceNote: seed.evidenceNote
  }]
}));

export const goldV5RootAdditions = [];
