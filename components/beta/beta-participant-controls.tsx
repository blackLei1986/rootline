"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { deleteBetaLog, exportBetaLog, getBetaParticipation, setBetaParticipation } from "@/lib/beta/validation-store";

export function BetaParticipantControls({userId}: {userId: string}) {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { setEnabled(getBetaParticipation(userId)); setMessage(""); }, [userId]);
  function updateParticipation(next: boolean) {
    setBetaParticipation(userId, next);
    const persisted = next && getBetaParticipation(userId);
    setEnabled(persisted);
    if (next && !persisted) {
      setMessage("浏览器存储不可用，未加入验证；学习仍可正常使用。");
      return;
    }
    setMessage(next ? "已加入。数据仅保存在此浏览器。" : "已退出并删除此账号在本浏览器中的验证记录。");
  }
  function download() {
    try {
      const url = URL.createObjectURL(exportBetaLog(userId));
      const link = document.createElement("a");
      link.href = url;
      link.download = "rootline-beta-validation.json";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("验证记录已导出。");
    } catch { setMessage("导出暂不可用；本地记录未更改。"); }
  }
  function remove() {
    deleteBetaLog(userId);
    setEnabled(false);
    setMessage("验证记录已从此浏览器删除；学习进度未更改。");
  }
  return <Card><CardContent className="p-6"><h2 className="text-lg font-bold">7 天 Beta 验证（可选）</h2>
    <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">加入后记录每日学习时长、来源分类、复习结果以及 Reading / Progress 使用次数，并可选填写反馈。只保存在当前浏览器，不上传；不收集词条答案、文章内容或链接。</p>
    <label className="mt-4 flex min-h-11 items-center gap-3 font-medium"><input type="checkbox" checked={enabled} onChange={(event) => updateParticipation(event.target.checked)} />加入 7 天 Beta 验证</label>
    {enabled && <div className="mt-4 flex flex-wrap gap-3"><button type="button" className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold" onClick={download}>导出验证记录</button><button type="button" className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold" onClick={remove}>删除验证记录</button></div>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </CardContent></Card>;
}
