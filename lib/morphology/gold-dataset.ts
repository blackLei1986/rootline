import { createHash } from "node:crypto";

import { roots } from "@/data/roots";
import { words } from "@/data/words";
import type { GoldDatasetV1, GoldRoot, GoldWord } from "@/lib/morphology/types";

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
