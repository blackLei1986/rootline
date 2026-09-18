"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OpmlControls() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  async function importFile(file: File | undefined) {
    if (!file) return;
    setMessage("正在导入…");
    const response = await fetch("/api/feeds/opml", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ xml: await file.text() })
    });
    const result = await response.json() as { imported?: number; failed?: number; message?: string };
    setMessage(response.ok
      ? `已导入 ${result.imported ?? 0} 个来源，${result.failed ?? 0} 个未通过安全检查。`
      : result.message ?? "OPML 导入失败。");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={inputRef} type="file" accept=".opml,.xml,text/xml" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}><Upload className="size-4" />导入 OPML</Button>
      <Button asChild variant="outline" size="sm"><a href="/api/feeds/opml"><Download className="size-4" />导出 OPML</a></Button>
      {message ? <p className="basis-full text-xs text-[var(--muted-foreground)]">{message}</p> : null}
    </div>
  );
}
