import { makeWord } from "@/data/word-factory";
import type { Word } from "@/types";

// A deliberately small, human-reviewable pilot record. The pipeline is built before scale.
export const masterPilotWords: Word[] = [
  makeWord({
    word: "significant",
    phonetic: "/sɪɡˈnɪfɪkənt/",
    partOfSpeech: ["adjective"],
    meaningZh: ["重要的；显著的"],
    meaningEn: ["important or large enough to be noticed"],
    frequency: "high",
    rootIds: [],
    morphology: "signific + ant",
    literalMeaning: "having importance or meaning",
    semanticEvolution: ["有意义的", "重要或显著的"],
    collocations: ["significant difference", "significant impact", "significant increase", "statistically significant"],
    family: ["significant", "significance", "significantly"],
    examples: [
      ["There was a significant change.", "发生了显著变化。"],
      ["The new policy had a significant impact on the industry.", "新政策对该行业产生了重大影响。"],
      ["The study found a significant relationship between sleep duration and academic performance.", "研究发现睡眠时长与学业表现之间存在显著关联。"]
    ],
    rootTier: "core",
    cefr: "B2",
    vocabularyBand: "core-3000",
    coverageTags: ["general", "academic", "ielts", "toefl"],
    examRelevance: { general: 88, academic: 94, ielts: 91, toefl: 90 },
    memoryHook: "significance 表示‘重要性’，significant 就是‘重要到值得注意’。",
    synonyms: ["important", "notable"],
    antonyms: ["minor", "insignificant"]
  })
];
