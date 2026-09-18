import { calculateRootValueScore } from "@/lib/value-scoring";
import type { Difficulty, Root, RootCategory, RootValueMetrics } from "@/types";

type RootSeed = Omit<Root, "rootValueScore">;

const makeRoot = (seed: RootSeed): Root => ({ ...seed, rootValueScore: calculateRootValueScore(seed.valueMetrics) });

function root(id: string, meaningEn: string[], meaningZh: string[], priority: number, category: RootCategory, difficulty: Difficulty, description: string, mnemonic: string, learningRationale: string, relatedRootIds: string[], valueMetrics: RootValueMetrics): Root {
  return makeRoot({ id, root: id, meaningEn, meaningZh, origin: "Latin", priority, category, difficulty, description, mnemonic, learningRationale, relatedRootIds, valueMetrics });
}

export const roots: Root[] = [
  root("spect", ["look", "see"], ["看", "观察"], 1, "vision", "easy", "spect 与“看、观察”相关，是英语里最实用的拉丁词根之一。", "spectator 是观众：他的主要动作就是看。", "它出现在多个高频词中，含义稳定，构词关系清晰，适合建立第一批猜词能力。", ["vis", "dict"], { frequencyCoverage: 96, usefulWordCount: 92, morphologyClarity: 94, transferValue: 92, learnerDifficulty: 20 }),
  root("port", ["carry"], ["运", "携带"], 2, "carrying", "easy", "port 来自表示“携带、运送”的拉丁语词干。", "portable 的东西可以被随身携带。", "高频词覆盖广，前缀变化直观，能连接交通、贸易、支持与报告等日常概念。", ["fer", "duc"], { frequencyCoverage: 94, usefulWordCount: 92, morphologyClarity: 95, transferValue: 88, learnerDifficulty: 18 }),
  root("dict", ["say", "speak"], ["说", "言说"], 3, "speech", "easy", "dict 与“说、断言”相关，常见于表达、判断与命名类词汇。", "dictionary 收集一种语言里被说出的词。", "它连接预测、裁决、矛盾等高频抽象概念，词形规律清楚。", ["scrib", "cred"], { frequencyCoverage: 91, usefulWordCount: 90, morphologyClarity: 92, transferValue: 91, learnerDifficulty: 25 }),
  root("form", ["shape", "form"], ["形状", "形成"], 4, "building", "easy", "form 表示形状或形成，是大量日常与学术词汇的构词核心。", "transform 就是把形状改变过去。", "词义直观，派生能力强，可以快速理解信息、改革、转变等常用词。", ["struct", "fac"], { frequencyCoverage: 96, usefulWordCount: 95, morphologyClarity: 94, transferValue: 94, learnerDifficulty: 18 }),
  root("ject", ["throw", "cast"], ["投", "掷"], 5, "action", "easy", "ject 来自拉丁语中“投、掷”的概念。", "project 像把想法向前投出去。", "前缀与核心动作结合紧密，能解释项目、拒绝、注射、物体等高频词。", ["tract", "mit"], { frequencyCoverage: 93, usefulWordCount: 94, morphologyClarity: 96, transferValue: 95, learnerDifficulty: 24 }),
  root("tract", ["pull", "draw"], ["拉", "牵引"], 6, "movement", "medium", "tract 表示拉、牵引或带动。", "tractor 的作用就是拉动。", "常见于吸引、合同、提取和分散注意等词，迁移价值很高。", ["ject", "duc"], { frequencyCoverage: 88, usefulWordCount: 90, morphologyClarity: 91, transferValue: 94, learnerDifficulty: 34 }),
  root("struct", ["build"], ["建造", "构建"], 7, "building", "easy", "struct 表示建造与组织结构。", "structure 就是一套被构建起来的结构。", "能覆盖建设、指示、破坏和基础设施等核心概念。", ["form", "fac"], { frequencyCoverage: 92, usefulWordCount: 93, morphologyClarity: 96, transferValue: 93, learnerDifficulty: 24 }),
  root("cred", ["believe", "trust"], ["相信", "信任"], 8, "thinking", "medium", "cred 与相信、信任和可信度有关。", "credit 建立在别人对你的信任上。", "它帮助理解信用、可靠、证书和难以置信等常用抽象词。", ["dict", "vis"], { frequencyCoverage: 86, usefulWordCount: 84, morphologyClarity: 88, transferValue: 88, learnerDifficulty: 35 }),
  root("mit", ["send"], ["送", "发送"], 9, "movement", "medium", "mit / miss 表示发送、放出。", "transmit 就是跨越距离发送。", "前缀变化能解释提交、允许、传输和省略，实用性强。", ["ject", "fer"], { frequencyCoverage: 91, usefulWordCount: 92, morphologyClarity: 86, transferValue: 91, learnerDifficulty: 38 }),
  root("vis", ["see"], ["看", "视觉"], 10, "vision", "easy", "vis / vid 与看和视觉有关。", "visible 就是能够被看见。", "与 spect 形成关联但词形不同，适合在交错学习后巩固视觉概念。", ["spect", "cred"], { frequencyCoverage: 94, usefulWordCount: 94, morphologyClarity: 91, transferValue: 92, learnerDifficulty: 22 }),
  root("scrib", ["write"], ["写", "书写"], 11, "writing", "easy", "scrib / script 表示书写。", "describe 原本像是把事物写下来。", "它连接描述、订阅、处方与手稿，构词规律非常清晰。", ["dict", "press"], { frequencyCoverage: 91, usefulWordCount: 90, morphologyClarity: 96, transferValue: 92, learnerDifficulty: 25 }),
  root("fer", ["carry", "bear"], ["携带", "承受"], 12, "carrying", "medium", "fer 表示携带、承受或带来。", "transfer 是把东西从一处带到另一处。", "覆盖转移、提供、偏好与推断等常用抽象动词。", ["port", "mit"], { frequencyCoverage: 90, usefulWordCount: 91, morphologyClarity: 85, transferValue: 91, learnerDifficulty: 40 }),
  root("duc", ["lead"], ["引导", "带领"], 13, "movement", "medium", "duc / duct 表示引导、带领。", "conduct 是把人或事一起带领起来。", "可连接教育、生产、减少和行为，覆盖面大。", ["tract", "port"], { frequencyCoverage: 91, usefulWordCount: 91, morphologyClarity: 86, transferValue: 92, learnerDifficulty: 38 }),
  root("rupt", ["break"], ["破", "断裂"], 14, "action", "easy", "rupt 表示破裂或打断。", "interrupt 就是在中间打断。", "核心意象鲜明，能帮助理解中断、爆发、破产与腐败。", ["press", "struct"], { frequencyCoverage: 84, usefulWordCount: 86, morphologyClarity: 95, transferValue: 89, learnerDifficulty: 28 }),
  root("press", ["press", "push"], ["压", "推动"], 15, "action", "easy", "press 表示按压或推动。", "pressure 就是施加在物体上的压力。", "日常和抽象用法都多，适合学习表达、压缩与抑郁等词。", ["rupt", "scrib"], { frequencyCoverage: 94, usefulWordCount: 93, morphologyClarity: 91, transferValue: 88, learnerDifficulty: 24 }),
  root("mov", ["move"], ["移动", "推动"], 16, "movement", "easy", "mov / mot 表示移动。", "movement 就是移动的过程。", "高频且直观，连接移动、移除、动机和情绪。", ["duc", "tract"], { frequencyCoverage: 97, usefulWordCount: 95, morphologyClarity: 91, transferValue: 88, learnerDifficulty: 18 }),
  root("cap", ["take", "seize"], ["拿", "抓取"], 17, "action", "medium", "cap / capt / cept 与拿取、抓住有关。", "capture 就是把某物抓住。", "词形会变化，但能解释接受、概念、捕获和例外等大量高频词。", ["ten", "fac"], { frequencyCoverage: 95, usefulWordCount: 95, morphologyClarity: 76, transferValue: 92, learnerDifficulty: 46 }),
  root("ten", ["hold"], ["持有", "保持"], 18, "other", "medium", "ten / tain / tent 表示握住、保持。", "maintain 就是持续保持。", "覆盖保持、获得、内容和注意等高价值词，但词形变化较多。", ["cap", "pos"], { frequencyCoverage: 94, usefulWordCount: 94, morphologyClarity: 74, transferValue: 90, learnerDifficulty: 48 }),
  root("fac", ["make", "do"], ["做", "制造"], 19, "action", "medium", "fac / fact / fect 表示做、制造。", "factory 是制造东西的地方。", "能解释事实、影响、效果、制造和促进，覆盖极广。", ["form", "struct"], { frequencyCoverage: 98, usefulWordCount: 98, morphologyClarity: 72, transferValue: 94, learnerDifficulty: 50 }),
  root("pos", ["put", "place"], ["放置", "位置"], 20, "position", "medium", "pos / pon 表示放置或位置。", "position 是事物被放置的位置。", "可连接位置、目的、反对、提议与组成，适合阶段后段学习。", ["ten", "ject"], { frequencyCoverage: 95, usefulWordCount: 95, morphologyClarity: 78, transferValue: 93, learnerDifficulty: 46 })
];

export const getRootById = (id: string) => roots.find((item) => item.id === id);
