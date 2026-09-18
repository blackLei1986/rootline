import { notFound } from "next/navigation";
import { ContentReview } from "@/components/content-review";
export default function ContentReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <div className="page-shell py-9 sm:py-12"><p className="label-caps text-xs font-bold text-[var(--primary)]">Development only</p><h1 className="mt-2 text-3xl font-bold tracking-tight">内容质量审核</h1><p className="mb-7 mt-2 text-[var(--muted-foreground)]">AI 生成内容先通过 Schema 和质量门，再进入人工可审计队列。</p><ContentReview /></div>;
}
