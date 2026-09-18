import type { VocabularyIndex } from "@/lib/vocabulary-index";

const IRREGULAR: Record<string, string> = {
  am: "be", are: "be", been: "be", being: "be", is: "be", was: "be", were: "be",
  had: "have", has: "have", did: "do", does: "do", done: "do",
  ran: "run", shown: "show", saw: "see", seen: "see", went: "go", gone: "go",
  made: "make", took: "take", taken: "take", found: "find", thought: "think",
  better: "good", best: "good", worse: "bad", worst: "bad",
  children: "child", people: "person", men: "man", women: "woman", studies: "study"
};

export function lemmatize(normalized: string, index: VocabularyIndex): string {
  if (index.wordBySurfaceForm.has(normalized)) return index.wordBySurfaceForm.get(normalized)!.lemma;
  if (IRREGULAR[normalized]) return IRREGULAR[normalized];
  const candidates: string[] = [];
  if (normalized.endsWith("ies") && normalized.length > 4) candidates.push(`${normalized.slice(0, -3)}y`);
  if (normalized.endsWith("ves") && normalized.length > 4) candidates.push(`${normalized.slice(0, -3)}f`, `${normalized.slice(0, -3)}fe`);
  if (normalized.endsWith("ing") && normalized.length > 5) {
    const stem = normalized.slice(0, -3);
    candidates.push(stem, `${stem}e`, stem.replace(/([b-df-hj-np-tv-z])\1$/, "$1"));
  }
  if (normalized.endsWith("ed") && normalized.length > 4) {
    const stem = normalized.slice(0, -2);
    candidates.push(stem, `${stem}e`, stem.replace(/([b-df-hj-np-tv-z])\1$/, "$1"));
  }
  if (normalized.endsWith("es") && normalized.length > 4) candidates.push(normalized.slice(0, -2), normalized.slice(0, -1));
  if (normalized.endsWith("s") && !normalized.endsWith("ss") && normalized.length > 3) candidates.push(normalized.slice(0, -1));
  return candidates.find((candidate) => index.wordByLemma.has(candidate) || index.wordBySurfaceForm.has(candidate)) ?? candidates[0] ?? normalized;
}
