export type MorphologyConfidenceV2 = "verified" | "derived" | "none";
export type MorphologyReviewStatus = "pending" | "approved" | "rejected";

export interface MorphologySegmentInput {
  position: number;
  kind: "prefix" | "root" | "suffix";
  surfaceForm: string;
  rootKey?: string;
  meaning?: string;
  explanation?: string;
}

export interface MorphologyRecordInput {
  datasetVersion: string;
  catalogWordId: string;
  lemma: string;
  familyKey: string | null;
  primaryRootKey: string | null;
  segments: MorphologySegmentInput[];
  confidence: MorphologyConfidenceV2;
  morphologyScore: number | null;
  source: string;
  provenance: Record<string, unknown>;
  formationExplanation: string | null;
  reviewStatus: MorphologyReviewStatus;
}

export interface GoldRoot {
  rootKey: string;
  root: string;
  meaningEn: string[];
  meaningZh: string[];
  educationalContent: {
    description: string;
    mnemonic?: string;
    learningRationale: string;
    origin?: string;
  };
}

export interface GoldWord {
  wordId: string;
  word: string;
  lemma: string;
  rootIds: string[];
  prefix?: { form: string; meaning: string };
  suffix?: { form: string; meaning: string };
  morphology: string;
  formationExplanation: string;
  teachingFamily: string[];
}

export interface GoldDatasetV1 {
  version: "gold-v1";
  source: "rootline-curated-static";
  provenance: {
    sourcePaths: ["data/roots.ts", "data/words.ts"];
    contentHash: string;
    importedBy: "rootline-morphology-gold-projection";
  };
  roots: GoldRoot[];
  words: GoldWord[];
}

export interface RootExpansionCandidate {
  root: string;
  coreMeaning: string;
  lexicalCues: string[];
  pedagogicalClarity: number;
  riskNotes: string;
}
