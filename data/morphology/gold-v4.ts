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
  { rootKey: "act", familyKey: "enact", word: "enact", sourceWord: "enact", evidenceNote: "enact is formed from en- plus act; the cited history traces act to Latin actus." },
  { rootKey: "gen", familyKey: "generous", word: "generous", sourceWord: "generous", evidenceNote: "The cited history derives generous from Latin generosus and genus." },
  { rootKey: "gen", familyKey: "degenerate", word: "degenerate", sourceWord: "degenerate", evidenceNote: "The cited history derives degenerate from Latin de genere and genus." },
  { rootKey: "graph", familyKey: "geographic", word: "geographic", sourceWord: "geographic", evidenceNote: "The cited history derives geographic from Greek geographikos, whose graph element is writing or description." },
  { rootKey: "loc", familyKey: "dislocation", word: "dislocation", sourceWord: "dislocation", evidenceNote: "The cited history identifies dislocation as a location derivative from Latin locus." },
  { rootKey: "loc", familyKey: "locus", word: "locus", sourceWord: "locus", evidenceNote: "The cited history identifies locus as the Latin source meaning place." },
  { rootKey: "log", familyKey: "terminology", word: "terminology", sourceWord: "terminology", evidenceNote: "The cited history identifies terminology as a Greek logos-derived -logy formation." },
  { rootKey: "log", familyKey: "analogue", word: "analogue", sourceWord: "analogue", evidenceNote: "The cited history traces analogue to Greek analogos, containing logos in its proportion or reason sense." },
  { rootKey: "phon", familyKey: "phonological", word: "phonological", sourceWord: "phonological", evidenceNote: "The cited history traces phonological through phonology to Greek phone, voice or sound." },
  { rootKey: "phon", familyKey: "headphone", word: "headphone", sourceWord: "headphone", evidenceNote: "The cited history identifies headphone as a compound built on phone, from Greek phone, voice or sound." },
  { rootKey: "micro", familyKey: "microscopic", word: "microscopic", sourceWord: "microscopic", evidenceNote: "The cited history identifies microscopic as a microscope derivative built on Greek mikros, small." },
  { rootKey: "micro", familyKey: "microbial", word: "microbial", sourceWord: "microbial", evidenceNote: "The cited history identifies microbial as a microbe derivative built on Greek mikros, small." },
  { rootKey: "volv", familyKey: "evolve", word: "evolve", sourceWord: "evolve", evidenceNote: "The cited history traces evolve to Latin evolvere, to unroll or turn out." },
  { rootKey: "volv", familyKey: "evolve", word: "evolution", sourceWord: "evolution", evidenceNote: "The cited history traces evolution to Latin evolvere, to unroll or turn out." },
  { rootKey: "volv", familyKey: "revolve", word: "revolve", sourceWord: "revolve", evidenceNote: "The cited history traces revolve to Latin revolvere, to turn back or roll back." },
  { rootKey: "volv", familyKey: "revolution", word: "revolution", sourceWord: "revolution", evidenceNote: "The cited history traces revolution to Latin revolutio, a turn or rolling back." },
  { rootKey: "volv", familyKey: "involve", word: "involve", sourceWord: "involve", evidenceNote: "The cited history traces involve to Latin involvere, to roll into or entangle." },
  { rootKey: "volv", familyKey: "involve", word: "involvement", sourceWord: "involvement", evidenceNote: "The cited history traces involvement through involve to Latin involvere, to roll into or entangle." }
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

export const goldV4RootAdditions: GoldRoot[] = [
  {
    rootKey: "volv",
    root: "volv",
    meaningEn: ["turn", "roll"],
    meaningZh: ["转动", "卷动"],
    educationalContent: {
      description: "volv connects turning, unfolding, returning, and involving vocabulary.",
      mnemonic: "A revolution is literally a turning around.",
      learningRationale: "The vetted production lemmas form separate, high-value turn and involvement families.",
      origin: "Latin volvere"
    },
    etymologyConfidence: "high",
    pedagogicalConfidence: 88,
    riskNotes: "Only the explicitly sourced volvere descendants are included.",
    provenance: [provenance({ rootKey: "volv", familyKey: "revolve", word: "revolve", sourceWord: "revolve", evidenceNote: "The cited history traces revolve to Latin revolvere, to turn back or roll back." })]
  }
];
