export function parseExcludedProductionLemmas(arguments_: readonly string[]): Set<string> {
  const value = arguments_.find((argument) => argument.startsWith("--exclude-lemmas="))?.slice("--exclude-lemmas=".length) ?? "";
  return new Set(value.split(",").map((lemma) => lemma.trim().toLowerCase()).filter(Boolean));
}

export function excludeProductionLemmas<T extends { lemma: string }>(
  candidates: readonly T[],
  excluded: ReadonlySet<string>
): T[] {
  if (excluded.size === 0) return [...candidates];
  return candidates.filter((candidate) => !excluded.has(candidate.lemma.toLowerCase()));
}
