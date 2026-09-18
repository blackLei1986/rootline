import type { CoverageTag } from "@/types";

export type LearningPathId = "general" | "academic" | "ielts" | "toefl";
export interface LearningPathDefinition { id: LearningPathId; title: string; eyebrow: string; description: string; tag: CoverageTag; modules: Array<{ title: string; description: string; topics: string[] }>; }

export const learningPaths: LearningPathDefinition[] = [
  { id: "general", title: "General Core", eyebrow: "High-frequency general vocabulary", description: "从最常用、最能提升文本覆盖率的词开始。词根只在真正有助于记忆时介入。", tag: "general", modules: [{ title: "Core 1000", description: "日常理解的骨架词汇。", topics: ["Daily life", "People", "Actions"] }, { title: "Core 2000", description: "延伸到常用阅读与表达。", topics: ["Work", "Society", "Media"] }] },
  { id: "academic", title: "Academic", eyebrow: "Academic vocabulary", description: "学术文本中可跨学科迁移的高价值词、搭配和句型。", tag: "academic", modules: [{ title: "Academic Core", description: "论证、研究、因果和比较。", topics: ["Research", "Evidence", "Argument"] }, { title: "Discipline Context", description: "在多学科句子中重复遇见。", topics: ["Science", "Humanities", "Social science"] }] },
  { id: "ielts", title: "IELTS-oriented", eyebrow: "IELTS-oriented vocabulary", description: "考试导向的共享视图，不是所谓‘官方必背词表’。已掌握的通用词不会重复学习。", tag: "ielts", modules: [{ title: "Reading & Listening", description: "长文本理解和高频话题听力。", topics: ["Education", "Environment", "Technology", "Health"] }, { title: "Writing & Speaking", description: "可直接调用的搭配和句型。", topics: ["Society", "Work", "Urban life", "Culture"] }] },
  { id: "toefl", title: "TOEFL-oriented", eyebrow: "TOEFL-oriented vocabulary", description: "围绕学术阅读、听力和校园场景的共享词汇视图。", tag: "toefl", modules: [{ title: "Academic Core", description: "跨学科高价值词汇。", topics: ["Research", "Analysis", "Evidence"] }, { title: "Reading & Listening", description: "讲座、校园与学科场景。", topics: ["Campus", "Science", "Social science", "Humanities"] }] }
];
export const getLearningPath = (id: string) => learningPaths.find((path) => path.id === id);
