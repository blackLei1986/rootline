import type { Course } from "@/types/course";

export const generalEnglishCore: Course = {
  id: "general-english-core",
  title: "General English Core",
  titleZh: "通用英语核心词根",
  description: "按高频覆盖、构词清晰度和迁移价值安排的核心学习路径。",
  stages: [
    {
      id: "stage-1",
      title: "Core Roots",
      titleZh: "高频核心词根",
      description: "先建立最能扩大日常词汇理解能力的核心词根网络。",
      order: 1,
      rootIds: ["spect", "port", "dict", "form", "ject", "tract", "struct", "cred", "mit", "vis", "scrib", "fer", "duc", "rupt", "press", "mov", "cap", "ten", "fac", "pos"],
      units: [
        { id: "unit-1", title: "基础构词意识", description: "从直观、高频且前缀关系清晰的词根开始。", order: 1, rootIds: ["spect", "port", "dict", "form", "ject"] },
        { id: "unit-2", title: "动作与结构", description: "理解拉、建造、相信、发送和视觉之间的词汇网络。", order: 2, rootIds: ["tract", "struct", "cred", "mit", "vis"] },
        { id: "unit-3", title: "表达与移动", description: "扩展书写、携带、引导、破裂和按压类词汇。", order: 3, rootIds: ["scrib", "fer", "duc", "rupt", "press"] },
        { id: "unit-4", title: "位置与形成", description: "处理词形变化更丰富的高覆盖词根。", order: 4, rootIds: ["mov", "cap", "ten", "fac", "pos"] }
      ]
    },
    {
      id: "stage-2",
      title: "High-Utility Roots",
      titleZh: "高实用词根",
      description: "扩展常见动作、关系与描述类词根。",
      order: 2,
      rootIds: [],
      previewRoots: ["voc", "gress", "pend", "sens", "vert"],
      units: [],
      unlockRule: { requiredRootCompletionRatio: 0.6, requiredAverageMastery: 55 }
    },
    {
      id: "stage-3",
      title: "Academic Expansion",
      titleZh: "学术词汇扩展",
      description: "进入学术文本中常见的抽象词根。",
      order: 3,
      rootIds: [],
      previewRoots: ["cogn", "log", "theor", "chron"],
      units: [],
      unlockRule: { requiredRootCompletionRatio: 0.6, requiredAverageMastery: 60 }
    },
    {
      id: "stage-4",
      title: "Advanced Roots",
      titleZh: "高级词根",
      description: "用于高级阅读和低频词汇推理的扩展框架。",
      order: 4,
      rootIds: [],
      previewRoots: ["bene", "mal", "phil", "anthrop"],
      units: [],
      unlockRule: { requiredRootCompletionRatio: 0.65, requiredAverageMastery: 65 }
    }
  ]
};
