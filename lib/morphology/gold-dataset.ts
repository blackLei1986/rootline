import { createHash } from "node:crypto";

import { roots } from "@/data/roots";
import { words } from "@/data/words";
import {
  goldV2RootAdditions,
  goldV2WordAdditions
} from "@/data/morphology/gold-v2";
import type {
  GoldDataset,
  GoldDatasetV1,
  GoldDatasetV2,
  GoldDatasetVersion,
  GoldRoot,
  GoldRootVariant,
  GoldWord
} from "@/lib/morphology/types";

function projectRoots(): GoldRoot[] {
  return roots.map((root) => ({
    rootKey: root.id,
    root: root.root,
    meaningEn: [...root.meaningEn],
    meaningZh: [...root.meaningZh],
    educationalContent: {
      description: root.description,
      mnemonic: root.mnemonic,
      learningRationale: root.learningRationale,
      origin: root.origin
    }
  }));
}

function projectWords(): GoldWord[] {
  return words.map((word) => ({
    wordId: word.id,
    word: word.word,
    lemma: word.lemma,
    rootIds: [...word.rootIds],
    prefix: word.prefix ? { ...word.prefix } : undefined,
    suffix: word.suffix ? { ...word.suffix } : undefined,
    morphology: word.morphology,
    formationExplanation: word.literalMeaning,
    teachingFamily: [...word.family]
  }));
}

function contentHash(rootsProjection: GoldRoot[], wordsProjection: GoldWord[]): string {
  return createHash("sha256")
    .update(JSON.stringify({ roots: rootsProjection, words: wordsProjection }))
    .digest("hex");
}

/** Creates an immutable projection of the existing editorial sources. */
export function createGoldDatasetV1(): GoldDatasetV1 {
  const rootProjection = projectRoots();
  const wordProjection = projectWords();

  return {
    version: "gold-v1",
    source: "rootline-curated-static",
    provenance: {
      sourcePaths: ["data/roots.ts", "data/words.ts"],
      contentHash: contentHash(rootProjection, wordProjection),
      importedBy: "rootline-morphology-gold-projection"
    },
    roots: rootProjection,
    words: wordProjection
  };
}

const capVariantProvenance = {
  sourceTitle: "Online Etymology Dictionary",
  sourceUrl: "https://www.etymonline.com/word/capture",
  accessedAt: "2026-09-22" as const,
  evidenceNote: "The cited capture word history supports the Latin capere form family used for the explicit variants."
};

const capVariants: GoldRootVariant[] = [
  { form: "capt", relation: "historical", explanation: "capt is a cited Latin capere participial form family.", provenance: capVariantProvenance },
  { form: "cept", relation: "historical", explanation: "cept is an explicitly curated capere form family.", provenance: capVariantProvenance },
  { form: "cip", relation: "historical", explanation: "cip is an explicitly curated capere form family.", provenance: capVariantProvenance }
];

export function createGoldDatasetV2(): GoldDatasetV2 {
  const v1 = createGoldDatasetV1();
  const baseRoots = v1.roots.map((root) => (
    root.rootKey === "cap" ? { ...root, variants: capVariants } : { ...root, variants: [] }
  ));
  const rootsProjection = [...baseRoots, ...goldV2RootAdditions];
  const wordsProjection = [...v1.words, ...goldV2WordAdditions];

  return {
    version: "gold-v2",
    source: "rootline-curated-static",
    provenance: {
      sourcePaths: ["data/roots.ts", "data/words.ts", "data/morphology/gold-v2.ts"],
      contentHash: contentHash(rootsProjection, wordsProjection),
      importedBy: "rootline-morphology-gold-v2-curation"
    },
    roots: rootsProjection,
    words: wordsProjection
  };
}

export function createGoldDataset(version: GoldDatasetVersion = "gold-v1"): GoldDataset {
  return version === "gold-v1" ? createGoldDatasetV1() : createGoldDatasetV2();
}
