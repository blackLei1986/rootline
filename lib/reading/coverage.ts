import type { ReadingCoverage, ReadingTokenMatch } from "@/types/reading";

const KNOWN = new Set(["fluent", "known"]);
const STABLE = new Set(["fluent"]);

function percent(value: number, total: number): number {
  return total ? Math.round((value / total) * 1000) / 10 : 100;
}

export function calculateReadingCoverage(tokens: ReadingTokenMatch[]): ReadingCoverage {
  const lexical = tokens.filter((token) => token.status !== "proper-noun" && token.status !== "number");
  const content = lexical.filter((token) => token.isContentWord);
  const known = lexical.filter((token) => !token.isContentWord || (token.status === "matched" && KNOWN.has(token.knowledgeState)));
  const knownContent = content.filter((token) => KNOWN.has(token.knowledgeState));
  const stableContent = content.filter((token) => STABLE.has(token.knowledgeState));
  const uniqueLemmas = new Map<string, ReadingTokenMatch>();
  const uniqueFamilies = new Map<string, ReadingTokenMatch>();
  for (const token of content) {
    if (token.lemma) uniqueLemmas.set(token.lemma, token);
    if (token.familyId) uniqueFamilies.set(token.familyId, token);
  }
  return {
    overallTokenCoverage: percent(known.length, lexical.length),
    contentWordCoverage: percent(knownContent.length, content.length),
    stableCoverage: percent(stableContent.length, content.length),
    lemmaCoverage: percent([...uniqueLemmas.values()].filter((token) => KNOWN.has(token.knowledgeState)).length, uniqueLemmas.size),
    familyCoverage: percent([...uniqueFamilies.values()].filter((token) => KNOWN.has(token.knowledgeState)).length, uniqueFamilies.size),
    unknownContentWords: content.filter((token) => token.knowledgeState === "unknown").length,
    fuzzyContentWords: content.filter((token) => token.knowledgeState === "fuzzy").length,
    untrackedContentWords: content.filter((token) => token.knowledgeState === "untracked" || token.status === "unknown").length,
    contentWordCount: content.length
  };
}
