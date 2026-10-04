"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { deleteBetaLog, exportBetaLog, getBetaParticipation, hasMalformedBetaLog, setBetaParticipation } from "@/lib/beta/validation-store";
import { flushBetaEvidence } from "@/lib/beta/evidence-outbox";
import { useBetaParticipation } from "@/lib/beta/use-beta-participation";

export function BetaParticipantControls({userId}: {userId: string}) {
  const remoteEvidence = process.env.NEXT_PUBLIC_BETA_EVIDENCE_ENABLED === "1";
  const [feedback, setFeedback] = useState<{userId: string; message: string} | null>(null);
  const enabled = useBetaParticipation(userId);
  const malformed = enabled && hasMalformedBetaLog(userId);
  const message = feedback?.userId === userId ? feedback.message : "";
  function updateParticipation(next: boolean) {
    setBetaParticipation(userId, next);
    const persisted = next && getBetaParticipation(userId);
    if (next && !persisted) {
      setFeedback({userId, message: "浏览器存储不可用，未加入验证；学习仍可正常使用。"});
      return;
    }
    setFeedback({userId, message: next
      ? (remoteEvidence ? "已加入。验证记录会按日期保存到隔离的 Beta 服务器。" : "已加入。数据仅保存在此浏览器。")
      : (remoteEvidence ? "已退出并删除此浏览器的验证缓存；已上传的服务器记录不会因此删除。" : "已退出并删除此账号在本浏览器中的验证记录。")});
  }
  async function download() {
    if (malformed && !remoteEvidence) {
      setFeedback({userId, message: "本地记录无法解析，不能导出为有效的验证报告；原始记录未更改。"});
      return;
    }
    try {
      let blob = exportBetaLog(userId);
      let filename = "rootline-beta-validation.json";
      if (remoteEvidence) {
        await flushBetaEvidence(userId);
        const response = await fetch("/api/beta/evidence", { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error("Server evidence unavailable");
        const report: unknown = await response.json();
        if (!report || typeof report !== "object" || (report as {accountId?: unknown}).accountId !== userId || !Array.isArray((report as {days?: unknown}).days)) throw new Error("Invalid server evidence");
        blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
        filename = `rootline-beta-evidence-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setFeedback({userId, message: "验证记录已导出。"});
    } catch { setFeedback({userId, message: remoteEvidence ? "服务器证据暂不可导出；不会用浏览器缓存冒充完整报告。" : "导出暂不可用；本地记录未更改。"}); }
  }
  function remove() {
    deleteBetaLog(userId);
    setFeedback({userId, message: remoteEvidence ? "本地验证缓存已删除；服务器上已保存的证据仍保留，学习进度未更改。" : "验证记录已从此浏览器删除；学习进度未更改。"});
  }
  return <Card><CardContent className="p-6"><h2 className="text-lg font-bold">7 天 Beta 验证（可选）</h2>
    <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">加入后记录每日学习时长、来源分类、复习结果以及 Reading / Progress 使用次数，并可选填写反馈。{remoteEvidence ? "记录会上传到隔离的 Beta 服务器，按学习日期保存；退出只清理此浏览器，已上传记录需联系 Beta 管理者删除。当前 Beta 请只用一个活动标签页。" : "只保存在当前浏览器，不上传。"}自动采集不包含词条答案、文章内容或链接；自由文本会保留你填写的内容，请勿输入这些信息或个人资料。</p>
    <label className="mt-4 flex min-h-11 items-center gap-3 font-medium"><input type="checkbox" checked={enabled} onChange={(event) => updateParticipation(event.target.checked)} />加入 7 天 Beta 验证</label>
    {malformed && <p role="alert" className="mt-3 text-sm text-amber-800">本地验证记录无法读取；为避免覆盖，已暂停记录新数据。原始记录仍保留在浏览器中；可自行备份浏览器数据后删除此验证记录。</p>}
    {enabled && <div className="mt-4 flex flex-wrap gap-3"><button type="button" className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold" onClick={download}>导出验证记录</button><button type="button" className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold" onClick={remove}>{remoteEvidence ? "删除本地记录" : "删除验证记录"}</button></div>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </CardContent></Card>;
}
