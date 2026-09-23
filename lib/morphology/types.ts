export type MorphologyConfidenceV2 = "verified" | "derived" | "none";
export type MorphologyReviewStatus = "pending" | "approved" | "rejected";
export type GoldDatasetVersion = "gold-v1" | "gold-v2" | "gold-v3" | "gold-v4";
export type EtymologyConfidence = "high" | "medium" | "cautious";
export type RootVariantRelation = "historical" | "pedagogical";

export interface RootProvenance {
  sourceTitle: string;
  sourceUrl: string;
  accessedAt: "2026-09-22";
  evidenceNote: string;
}

export interface GoldRootVariant {
  form: string;
  relation: RootVariantRelation;
  explanation: string;
  provenance: RootProvenance;
}

export interface GoldLexicalFamily {
  key: string;
  displayName: string;
  formationExplanation: string;
}

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
  variants?: GoldRootVariant[];
  etymologyConfidence?: EtymologyConfidence;
  pedagogicalConfidence?: number;
  riskNotes?: string;
  provenance?: RootProvenance[];
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
  lexicalFamily?: GoldLexicalFamily;
  provenance?: RootProvenance[];
}

export interface GoldDataset {
  version: GoldDatasetVersion;
  source: "rootline-curated-static";
  provenance: {
    sourcePaths: string[];
    contentHash: string;
    importedBy: string;
  };
  roots: GoldRoot[];
  words: GoldWord[];
}

export type GoldDatasetV1 = GoldDataset & { version: "gold-v1" };
export type GoldDatasetV2 = GoldDataset & { version: "gold-v2" };
export type GoldDatasetV3 = GoldDataset & { version: "gold-v3" };
export type GoldDatasetV4 = GoldDataset & { version: "gold-v4" };

export interface RootExpansionCandidate {
  root: string;
  coreMeaning: string;
  lexicalCues: string[];
  pedagogicalClarity: number;
  riskNotes: string;
}
