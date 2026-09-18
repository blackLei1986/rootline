import type { ContentTier, CoverageTag, ProductionVocabularyEntry } from "@/types";

export type VocabularySearchRow = readonly [
  id: string,
  word: string,
  meaningZh: string,
  tier: ContentTier,
  score: number,
  coverageTags: CoverageTag[],
  partOfSpeech: string[],
  frequencyRank: number
];

export interface VocabularySearchResult {
  id: string;
  word: string;
  meaningZh: string;
  tier: ContentTier;
  score: number;
  coverageTags: CoverageTag[];
  partOfSpeech: string[];
  frequencyRank: number;
}

const tierOrder: Record<ContentTier, number> = {
  "tier-1-core": 0,
  "tier-2-important": 1,
  "tier-3-recognition": 2,
  "tier-4-extension": 3
};

export function unpackSearchRow(row: VocabularySearchRow): VocabularySearchResult {
  return { id: row[0], word: row[1], meaningZh: row[2], tier: row[3], score: row[4], coverageTags: row[5], partOfSpeech: row[6], frequencyRank: row[7] };
}

export function searchVocabulary(rows: VocabularySearchRow[], query: string, limit = 40): VocabularySearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return rows
    .map(unpackSearchRow)
    .filter((entry) => entry.word.toLowerCase().includes(normalized) || entry.meaningZh.includes(query.trim()))
    .sort((left, right) => {
      const leftExact = Number(left.word.toLowerCase() === normalized);
      const rightExact = Number(right.word.toLowerCase() === normalized);
      const leftPrefix = Number(left.word.toLowerCase().startsWith(normalized));
      const rightPrefix = Number(right.word.toLowerCase().startsWith(normalized));
      return rightExact - leftExact || rightPrefix - leftPrefix || tierOrder[left.tier] - tierOrder[right.tier] || right.score - left.score || left.word.localeCompare(right.word);
    })
    .slice(0, limit);
}

export function dailyBucketIndex(date: Date, bucketCount = 90): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return ((day - 1) % bucketCount + bucketCount) % bucketCount;
}

export async function loadDailyVocabulary(date: Date = new Date()): Promise<ProductionVocabularyEntry[]> {
  const bucket = String(dailyBucketIndex(date)).padStart(3, "0");
  const response = await fetch(`/vocabulary-data/daily/${bucket}.json`);
  if (!response.ok) throw new Error("今日词汇候选加载失败");
  return response.json() as Promise<ProductionVocabularyEntry[]>;
}

export async function loadVocabularyEntries(ids: string[]): Promise<ProductionVocabularyEntry[]> {
  const wanted = new Set(ids.map((id) => id.toLowerCase()));
  const letters = [...new Set(ids.map((id) => id[0]?.toLowerCase()).filter((letter): letter is string => Boolean(letter && /^[a-z]$/.test(letter))))];
  const shards = await Promise.all(letters.map(async (letter) => {
    const response = await fetch(`/vocabulary-data/${letter}.json`);
    return response.ok ? response.json() as Promise<ProductionVocabularyEntry[]> : [];
  }));
  return shards.flat().filter((entry) => wanted.has(entry.id.toLowerCase()) || wanted.has(entry.lemma.toLowerCase()));
}

export async function loadVocabularyEntry(id: string): Promise<ProductionVocabularyEntry | null> {
  return (await loadVocabularyEntries([id]))[0] ?? null;
}

export function tierLabel(tier: ContentTier): string {
  return {
    "tier-1-core": "核心主动词",
    "tier-2-important": "重要理解词",
    "tier-3-recognition": "阅读识别词",
    "tier-4-extension": "扩展词"
  }[tier];
}
