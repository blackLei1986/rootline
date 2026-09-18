export type ReadingDegradationReason =
  | "NO_SUBSCRIPTIONS"
  | "NO_FRESH_ARTICLES"
  | "NO_LEVEL_MATCH"
  | "EXTRACTION_UNAVAILABLE"
  | "ANALYSIS_STALE";

export interface ReadingAvailability {
  subscriptionCount: number;
  freshArticleCount: number;
  extractedArticleCount: number;
  analyzedArticleCount: number;
  eligibleArticleCount: number;
}

export interface ReadingDegradationCopy {
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
}

const copy: Record<ReadingDegradationReason, ReadingDegradationCopy> = {
  NO_SUBSCRIPTIONS: { title: "还没有可用的阅读来源", detail: "词汇计划照常进行；添加少量高质量来源后，系统会自动选文。", actionLabel: "添加阅读来源", actionHref: "/reading/sources" },
  NO_FRESH_ARTICLES: { title: "今天没有合适的新文章", detail: "来源暂时没有新内容，词汇部分不受影响。", actionLabel: "查看阅读来源", actionHref: "/reading/sources" },
  NO_LEVEL_MATCH: { title: "今天没有难度合适的文章", detail: "系统不会为了凑数塞入过难或过易的文章。", actionLabel: "导入一篇文章", actionHref: "/reading/import" },
  EXTRACTION_UNAVAILABLE: { title: "文章正文暂时不可用", detail: "系统保留今天的词汇计划，文章处理恢复后会重新筛选。", actionLabel: "打开阅读中心", actionHref: "/reading" },
  ANALYSIS_STALE: { title: "文章分析正在更新", detail: "旧分析不会被静默用于 Today，词汇计划仍可完成。", actionLabel: "打开阅读中心", actionHref: "/reading" }
};

export function categorizeTodayReadingDegradation(availability: ReadingAvailability): ReadingDegradationReason | null {
  if (availability.eligibleArticleCount > 0) return null;
  if (availability.subscriptionCount <= 0) return "NO_SUBSCRIPTIONS";
  if (availability.freshArticleCount <= 0) return "NO_FRESH_ARTICLES";
  if (availability.extractedArticleCount <= 0) return "EXTRACTION_UNAVAILABLE";
  if (availability.analyzedArticleCount <= 0) return "ANALYSIS_STALE";
  return "NO_LEVEL_MATCH";
}

export function getReadingDegradationCopy(reason: ReadingDegradationReason): ReadingDegradationCopy {
  return copy[reason];
}

export function isReadingDegradationReason(value: string | null): value is ReadingDegradationReason {
  return value !== null && value in copy;
}
