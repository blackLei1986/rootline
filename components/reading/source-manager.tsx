"use client";

import { useState } from "react";
import { Plus, Rss, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OpmlControls } from "@/components/reading/opml-controls";
import { starterFeeds } from "@/data/starter-feeds";
import type { FeedSourceDTO } from "@/types/feeds";

export function SourceManager({ initialSources }: { initialSources: FeedSourceDTO[] }) {
  const [sources, setSources] = useState(initialSources);
  const [url, setUrl] = useState("");
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function subscribe(feedUrl: string) {
    setBusyUrl(feedUrl);
    setMessage("");
    try {
      const response = await fetch("/api/feeds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: feedUrl })
      });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "订阅失败。");
      const refreshed = await fetch("/api/feeds", { cache: "no-store" });
      const data = await refreshed.json() as { sources: FeedSourceDTO[] };
      setSources(data.sources);
      setUrl("");
      setMessage("订阅已添加，系统会从新文章中挑选最适合你的内容。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "订阅失败。");
    } finally {
      setBusyUrl(null);
    }
  }

  async function unsubscribe(sourceId: string) {
    setBusyUrl(sourceId);
    const response = await fetch(`/api/feeds?sourceId=${encodeURIComponent(sourceId)}`, { method: "DELETE" });
    if (response.ok) setSources((current) => current.filter((source) => source.id !== sourceId));
    setBusyUrl(null);
  }

  return (
    <div className="space-y-8">
      <Card><CardContent className="p-6">
        <h2 className="text-lg font-bold">添加 RSS / Atom 地址</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">少量高质量来源就够了。Rootline 会筛选文章，不会展示完整未读积压。</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/feed.xml" className="h-11 flex-1 rounded-xl border bg-white px-4 text-sm outline-none focus:border-indigo-400" />
          <Button disabled={!url || busyUrl !== null} onClick={() => void subscribe(url)}><Plus className="size-4" />添加来源</Button>
        </div>
        <div className="mt-4"><OpmlControls /></div>
        {message ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">{message}</p> : null}
      </CardContent></Card>

      <section>
        <h2 className="text-xl font-bold">我的来源</h2>
        <div className="mt-3 grid gap-3">
          {sources.length ? sources.map((source) => (
            <div key={source.id} className="flex items-center justify-between gap-4 rounded-2xl border bg-white p-4">
              <div className="min-w-0"><p className="truncate font-semibold">{source.title}</p><p className="truncate text-xs text-[var(--muted-foreground)]">{source.feedUrl}</p></div>
              <Button variant="ghost" size="icon" aria-label={`移除 ${source.title}`} disabled={busyUrl === source.id} onClick={() => void unsubscribe(source.id)}><Trash2 className="size-4" /></Button>
            </div>
          )) : <p className="rounded-2xl border border-dashed p-6 text-sm text-[var(--muted-foreground)]">还没有订阅来源，可以从下面的精选列表开始。</p>}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2"><Rss className="size-5 text-[var(--primary)]" /><h2 className="text-xl font-bold">精选起步来源</h2></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {starterFeeds.map((source) => (
            <Card key={source.feedUrl}><CardContent className="p-5"><p className="font-semibold">{source.title}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{source.topic} · {source.attribution}</p><Button className="mt-4" size="sm" variant="outline" disabled={busyUrl !== null || sources.some((item) => item.feedUrl === source.feedUrl)} onClick={() => void subscribe(source.feedUrl)}>添加</Button></CardContent></Card>
          ))}
        </div>
      </section>
    </div>
  );
}
