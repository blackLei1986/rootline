"use client";

import { useState } from "react";
import { Check, ExternalLink, EyeOff, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markArticleCompleted } from "@/lib/reading-actions";

export function ArticleReader({ article }: { article: {
  id: string;
  title: string;
  text: string;
  publisherUrl: string;
  author: string | null;
  sourceTitle: string;
} }) {
  const [message, setMessage] = useState("");

  async function update(state: { saved?: boolean; hidden?: boolean; completed?: boolean }, success: string) {
    const response = await fetch(`/api/articles/${article.id}/state`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state)
    });
    setMessage(response.ok ? success : "暂时无法保存，请稍后重试。");
  }

  async function complete() {
    setMessage(await markArticleCompleted(article.id) ? "已标记完成，并更新跨文章词汇证据。" : "暂时无法保存，请稍后重试。");
  }

  return (
    <article className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-[var(--primary)]">{article.sourceTitle}</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{article.title}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--muted-foreground)]">
        {article.author ? <span>{article.author}</span> : null}
        <a href={article.publisherUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">查看原文<ExternalLink className="size-3.5" /></a>
      </div>
      <div className="mt-7 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void update({ saved: true }, "已保存。") }><Save className="size-4" />保存</Button>
        <Button size="sm" variant="outline" onClick={() => void update({ hidden: true }, "已隐藏。") }><EyeOff className="size-4" />不再推荐</Button>
        <Button size="sm" onClick={() => void complete()}><Check className="size-4" />完成阅读</Button>
      </div>
      {message ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">{message}</p> : null}
      <div className="mt-10 space-y-6 text-lg leading-9 text-slate-800">
        {article.text.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
    </article>
  );
}
