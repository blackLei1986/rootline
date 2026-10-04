"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProductState } from "@/components/product-state";
import {clearPendingTodayCredit, creditAcceptedTodayEvent, hasTodayLearningCredit, readPendingTodayCredit,
  reconcilePendingTodayCredit, savePendingTodayCredit, wasTodayCreditAccepted} from "@/lib/today/learning-credit";
import type {TodayEventInput} from "@/lib/today/events";
import { selectFinalReviewTargets, selectMiniReviewTargets } from "@/lib/today/review-selection";
import { estimateRemainingMinutes } from "@/lib/today/remaining-effort";
import type { DailyTargetSnapshot, TodayPlanDTO, TodaySessionDTO } from "@/types/today";
import type { RecognitionState } from "@/types/progress";
import { recordBetaEvent, recordTodayBetaTransition, type TodayBetaTransition } from "@/lib/beta/validation-store";
import { attachBetaVisibilityTracking, switchBetaActivity, type BetaActivity } from "@/lib/beta/validation-timer";
import { BetaJournal } from "@/components/today/beta-journal";
type View = "setup" | "recognition" | "learning-card" | "association" | "cloze" | "recall" | "mini" | "final" | "complete";

export function Daily30Flow({ plan, betaUserId }: { plan: TodayPlanDTO; betaUserId?: string }) {
  const targets = useMemo(() => plan.dailyTargets ?? [], [plan.dailyTargets]);
  const [session, setSession] = useState<TodaySessionDTO | null>(null);
  const revision = useRef(0);
  const [view, setView] = useState<View>("setup");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [saveUncertain, setSaveUncertain] = useState(false);
  useEffect(() => {
    if (!betaUserId || !plan.dailyTargets) return;
    const sourceCounts = { carryover: 0, weak: 0, "root-core": 0, support: 0 };
    for (const item of plan.dailyTargets) {
      if (item.source === "carryover") sourceCounts.carryover++;
      else if (item.source === "weak") sourceCounts.weak++;
      const origin = item.originSource ?? (item.source === "root-core" || item.source === "support" ? item.source : undefined);
      if (origin) sourceCounts[origin]++;
    }
    recordBetaEvent(betaUserId, plan.date, { type: "plan-observed", targetCount: plan.dailyTargets.length, newWordCount: plan.dailyTargets.filter((item) => item.source === "root-core" || item.source === "support").length, sourceCounts });
    if (plan.planCreated) recordBetaEvent(betaUserId, plan.date, { type: "plan-created" });
  }, [betaUserId, plan.date, plan.dailyTargets, plan.planCreated]);
  useEffect(() => { let active = true; (async () => {
    const pending = readPendingTodayCredit(plan.id);
    let pendingAccepted = false;
    if (pending) {
      pendingAccepted = await reconcilePendingTodayCredit(pending);
      if (pendingAccepted) creditAcceptedTodayEvent(pending);
      clearPendingTodayCredit(plan.id);
    }
    const s = await refreshTodaySession(plan.id);
    if (!active) return;
    if (betaUserId && pendingAccepted && pending?.type === "review_answered" && pending.targetId && pending.reviewKind && s.reviewAnswers?.[`${pending.reviewKind}:${pending.targetId}`] === pending.correct) {
      const reviewTarget = targets.find((item) => item.wordId === pending.targetId);
      if (reviewTarget) recordTodayBetaTransition(betaUserId, plan.date, s.eventRevision ?? 0, {type: "review-outcome", kind: pending.reviewKind, source: reviewTarget.source, originSource: reviewTarget.originSource, correct: Boolean(pending.correct)});
    }
    revision.current = s.eventRevision ?? 0; setSession(s); if (s.status === "complete") {
      if (betaUserId) recordBetaEvent(betaUserId, plan.date, {type: "session-completed"});
      setView("complete");
    }
  })().catch(() => { if (active) {setSaveUncertain(true); setError("今日进度暂时无法核对。请重新读取今日进度。");} }); return () => { active = false; }; }, [betaUserId, plan.date, plan.id, targets]);
  const block = session?.currentBlock ?? 1;
  const blockTargets = targets.filter((word) => word.block === block);
  const target = blockTargets.find((word) => session?.targetProgress?.[word.wordId]?.status === "active") ?? blockTargets.find((word) => !session?.completedTargetIds?.includes(word.wordId));
  const done = targets.filter((word) => session?.completedTargetIds?.includes(word.wordId)).length;
  const remainingMinutes = estimateRemainingMinutes(plan.estimatedMinutes, done, targets.length);
  useEffect(() => {
    if (!betaUserId || busy || saveUncertain || view === "setup" || view === "complete") return;
    const suffix = ["a", "b", "c"][block - 1];
    const activity = (view === "mini" ? `mini-review-${suffix}` : view === "final" ? "final-review" : `block-${suffix}`) as BetaActivity;
    switchBetaActivity(betaUserId, plan.date, activity);
    return attachBetaVisibilityTracking(betaUserId, plan.date);
  }, [betaUserId, block, busy, plan.date, saveUncertain, view]);
  const roots = [...new Map(blockTargets.filter((word) => word.rootId).map((word) => [word.rootId, word])).values()];
  async function emit(event: Record<string, unknown>, betaTransition?: TodayBetaTransition): Promise<TodaySessionDTO | null> {
    if (saveUncertain || busy) return null;
    setBusy(true);
    setError("");
    let response: Response | null = null;
    try {
      const submitted = {operationId: crypto.randomUUID(), planId: plan.id, occurredAt: new Date().toISOString(),
        stage: "learn", expectedRevision: revision.current, ...event} as TodayEventInput;
      savePendingTodayCredit(submitted);
      try {
        response = await fetch("/api/today/events", {method: "POST", headers: {"content-type": "application/json"},
          body: JSON.stringify(submitted)});
        if (response.ok) {
          const saved = await response.json() as TodaySessionDTO;
          if (hasTodayLearningCredit(submitted)) { creditAcceptedTodayEvent(submitted); clearPendingTodayCredit(plan.id); }
          revision.current = saved.eventRevision ?? revision.current + 1;
          if (betaUserId && betaTransition) recordTodayBetaTransition(betaUserId, plan.date, revision.current, betaTransition);
          setSession(saved);
          return saved;
        }
      } catch { /* The request may have been applied before its response was lost. */ }
      let accepted = false;
      if (hasTodayLearningCredit(submitted)) {
        accepted = response?.status === 409
          ? await wasTodayCreditAccepted(submitted)
          : await reconcilePendingTodayCredit(submitted);
        if (accepted) creditAcceptedTodayEvent(submitted);
        clearPendingTodayCredit(plan.id);
      }
      const refreshed = await refreshTodaySession(plan.id);
      if (betaUserId) {
        if (betaTransition?.type === "session-started" && refreshed.status === "active") recordTodayBetaTransition(betaUserId, plan.date, refreshed.eventRevision ?? 0, betaTransition);
        if (betaTransition?.type === "review-outcome" && accepted && submitted.type === "review_answered" && refreshed.reviewAnswers?.[`${submitted.reviewKind}:${submitted.targetId}`] === submitted.correct) {
          recordTodayBetaTransition(betaUserId, plan.date, refreshed.eventRevision ?? 0, betaTransition);
        }
        if (refreshed.status === "complete") recordBetaEvent(betaUserId, plan.date, {type: "session-completed"});
      }
      if (betaUserId) {
        recordBetaEvent(betaUserId, plan.date, { type: "recoverable-error" });
        if (response?.status === 409) recordBetaEvent(betaUserId, plan.date, { type: "conflict-recovery" });
      }
      revision.current = refreshed.eventRevision ?? 0;
      setSession(refreshed);
      setView(refreshed.status === "complete" ? "complete" : "setup");
      setError(response?.status === 409 ? "其他页面已更新今日学习；已同步最新进度，请确认后继续。" : "保存结果已核对；已同步最新进度，请确认后继续。");
      return null;
    } catch {
      setSaveUncertain(true);
      setError("保存状态尚不确定；为避免覆盖进度，已暂停操作。请重新读取今日进度。");
      return null;
    } finally { setBusy(false); }
  }
  async function recognize(state: RecognitionState) { if (!target) return; const s = await emit({ type: "target_recognized", targetId: target.wordId, block, recognitionState: state }); if (!s) return; setView(state === "known" ? "association" : "learning-card"); }
  async function finish(activity: "learning-card" | "association" | "cloze" | "recall", correct = true) { if (!target) return; const s = await emit({ type: "target_activity_completed", targetId: target.wordId, block, activity, correct }); if (!s) return; setAnswer(""); const completeBlock = blockTargets.every((word) => s.completedTargetIds?.includes(word.wordId)); setView(completeBlock ? "mini" : nextView(targets, s)); }
  const needsReinforcement = (word: DailyTargetSnapshot) => { const progress = session?.targetProgress?.[word.wordId]; return progress?.recognitionState !== "known" || progress.outcomes.association === false || progress.outcomes.cloze === false || progress.outcomes.recall === false; };
  async function answerReview(kind: "mini" | "final", reviewTarget: DailyTargetSnapshot, correct: boolean) { const s = await emit({ type: "review_answered", reviewKind: kind, targetId: reviewTarget.wordId, block: reviewTarget.block, correct }, { type: "review-outcome", kind, source: reviewTarget.source, originSource: reviewTarget.originSource, correct }); if (!s) return; setAnswer(""); }
  async function completeReview(kind: "mini" | "final") { if (kind === "mini") { const s = await emit({ type: "mini_review_completed", block }); if (s) setView(s.completedMiniReviewBlocks?.length === new Set(targets.map((word) => word.block)).size ? "final" : "recognition"); return; } const s = await emit({ type: "final_review_completed" }); if (s) { const completed = await emit({ type: "today_completed", stage: "summary" }, {type: "session-completed"}); if (completed) setView("complete"); } }
  async function finishPersistedReview() { const completed = await emit({ type: "today_completed", stage: "summary" }, {type: "session-completed"}); if (completed) setView("complete"); }
  if (saveUncertain) return <main className="page-shell max-w-3xl py-10"><ProductState title="保存状态尚不确定" description="为避免覆盖今日进度，已暂停操作。请重新读取今日进度。" actionHref="/today" actionLabel="重新读取今日进度" variant="error" /></main>;
  if (view === "setup") return <main className="page-shell max-w-3xl py-10"><p className="text-xs font-bold text-indigo-700">TODAY · CORE LOOP</p><h1 className="mt-2 text-4xl font-bold">今日学习</h1><Card className="mt-6"><CardContent className="p-6"><p>今日目标　<span>{done} / {targets.length}</span></p><Progress className="mt-3" value={targets.length ? done / targets.length * 100 : 0} />{remainingMinutes !== null && <p className="mt-3 text-sm text-[var(--muted-foreground)]">约 {remainingMinutes} 分钟</p>}<div className="mt-5 flex gap-5 text-sm"><span>Root Core {targets.filter((w) => w.source === "root-core" || w.originSource === "root-core").length}</span><span>Support {targets.filter((w) => w.source === "support" || w.originSource === "support").length}</span></div><Button className="mt-6 w-full" disabled={busy || !targets.length || !session} onClick={async () => { if (session?.status === "active") { setView(nextView(targets, session)); return; } const started = await emit({ type: "today_started" }, {type: "session-started"}); if (started) setView("recognition"); }}>{session?.status === "active" ? "继续今日学习" : "开始今日学习"}</Button></CardContent></Card><Button asChild variant="outline" className="mt-4 w-full"><Link href="/reading">今日阅读</Link></Button>{targets.length < 30 && <p className="mt-3 text-sm text-amber-700">今日实际安排 {targets.length} 词，不会重复补数。</p>}{roots.length > 0 && <Card className="mt-5"><CardContent className="p-5"><h2 className="font-semibold">Block {block} · Root Preview</h2>{roots.slice(0, 4).map((root) => <RootPreview key={root.rootId} target={root} />)}</CardContent></Card>}{error && <p role="alert">{error}</p>}</main>;
  if (view === "complete") { const encounteredRoots = [...new Set(targets.flatMap((word) => word.rootForm ? [word.rootForm] : []))]; const reinforcementWords = targets.filter(needsReinforcement); return <main className="page-shell max-w-2xl py-16"><Card><CardContent className="p-8 text-center"><p className="text-sm font-bold text-emerald-700">今日完成</p><h1 className="mt-3 text-3xl font-bold">{done} / {targets.length}</h1><p className="mt-3">Root Core {targets.filter((word) => word.source === "root-core" || word.originSource === "root-core").length} · Support {targets.filter((word) => word.source === "support" || word.originSource === "support").length}</p><p className="mt-2">复习正确率 {session?.reviewAccuracy?.total ? Math.round(session.reviewAccuracy.correct / session.reviewAccuracy.total * 100) : 100}%</p><p className="mt-2">待继续巩固 {reinforcementWords.length} 词{reinforcementWords.length ? `：${reinforcementWords.map((word) => word.word).join("、")}` : ""}</p>{encounteredRoots.length > 0 && <p className="mt-2">今日接触词根：{encounteredRoots.join("、")}</p>}<p className="mt-3 text-sm text-[var(--muted-foreground)]">今日计划已完成，不会生成第二批新词。</p></CardContent></Card>{betaUserId && <BetaJournal userId={betaUserId} learningDate={plan.date} />}<Button asChild variant="outline" className="mt-4 w-full"><Link href="/reading">今日阅读</Link></Button><Button asChild variant="outline" className="mt-3 w-full"><Link href="/progress">查看进度</Link></Button></main>; }
  if (view === "mini" || view === "final") { const kind = view === "mini" ? "mini" : "final"; const selected = kind === "mini" ? selectMiniReviewTargets(targets, block) : selectFinalReviewTargets(targets, session?.targetProgress ?? {}); const pending = selected.find((word) => !Object.hasOwn(session?.reviewAnswers ?? {}, `${kind}:${word.wordId}`)); const finishOnly = kind === "final" && session?.finalReviewComplete; const allAnswered = !pending; return <main className="page-shell max-w-2xl py-10"><Card><CardContent className="p-6"><h1 className="text-2xl font-bold">{kind === "mini" ? "Mini Review" : "Final Review"}</h1><p className="mt-2">{finishOnly ? "Final Review 已保存，继续完成今日计划。" : pending ? `回想 ${pending.word} 的核心含义：${answer}` : "本轮回忆已完成，继续下一步。"}</p>{pending && !finishOnly && <><Button variant="outline" className="mt-3" disabled={busy} onClick={() => setAnswer(pending.coreMeaningZh)}>显示答案</Button><div className="mt-5 grid grid-cols-2 gap-3"><Button variant="outline" disabled={busy} onClick={() => void answerReview(kind, pending, false)}>没想起来</Button><Button disabled={busy} onClick={() => void answerReview(kind, pending, true)}>想起来了</Button></div></>}{((finishOnly) || allAnswered) && <Button className="mt-5 w-full" onClick={() => finishOnly ? void finishPersistedReview() : void completeReview(kind)} disabled={busy}>{finishOnly ? "完成今日计划" : kind === "mini" ? "继续下一个 Block" : "完成今日计划"}</Button>}{error && <p role="alert">{error}</p>}</CardContent></Card></main>; }
  if (!target) return null;
  const persisted = session?.targetProgress?.[target.wordId]?.currentActivity;
  const step = view === "recognition" && persisted ? persisted : view;
  const isRootCore = target.source === "root-core" || target.originSource === "root-core";
  const associationAnswer = isRootCore ? target.rootMeaningZh[0] : target.coreMeaningZh;
  const choices = [...new Set([associationAnswer, ...targets.filter((w) => w.wordId !== target.wordId).map((w) => isRootCore ? w.rootMeaningZh[0] : w.coreMeaningZh).filter((value): value is string => Boolean(value))])].slice(0, 4);
  return <main className="page-shell max-w-3xl py-8"><Progress value={targets.length ? done / targets.length * 100 : 0} /><p className="mt-3 text-sm">Block {block} · {done}/{targets.length}</p><Card className="mt-4 min-h-96"><CardContent className="p-6 text-center"><h1 className="text-4xl font-bold">{target.word}</h1><p className="mt-2 text-sm text-gray-500">{target.phonetic}</p>
    {step === "recognition" && <div className="mt-6 grid gap-2 sm:grid-cols-3">{([["known","认识"],["fuzzy","模糊"],["unknown","不认识"]] as const).map(([s,l]) => <Button key={s} disabled={busy} onClick={() => recognize(s)}>{l}</Button>)}</div>}
    {step === "learning-card" && <><p className="mt-4 text-2xl text-indigo-700">{target.coreMeaningZh}</p>{target.morphology && <RootPreview target={target} />}<p className="mt-3">{target.coreDefinitionEn}</p><p className="mt-4 rounded border p-4 text-left">{target.example}</p><Button className="mt-4" disabled={busy} onClick={() => finish("learning-card")}>继续到联想</Button></>}
    {step === "association" && <><p className="mt-4">{isRootCore ? `选择词根 ${target.rootForm ?? ""} 的核心含义` : "选择核心含义"}</p><div className="mt-4 grid gap-2">{choices.map((choice) => <Button key={choice} variant="outline" disabled={busy} onClick={() => finish("association", choice === associationAnswer)}>{choice}</Button>)}</div></>}
    {step === "cloze" && <><p className="mt-4">{target.example.replace(target.word, "______")}</p><input className="mt-4 h-11 rounded border px-3" aria-label="填入目标词" value={answer} onChange={(e) => setAnswer(e.target.value)} /><Button className="ml-2" disabled={busy || !answer} onClick={() => finish("cloze", answer.trim().toLowerCase() === target.lemma.toLowerCase())}>提交</Button></>}
    {step === "recall" && <><p className="mt-4">回想核心含义：{answer}</p><Button variant="outline" className="mt-3" onClick={() => setAnswer(target.coreMeaningZh)}>显示答案</Button><div className="mt-4 flex justify-center gap-2"><Button variant="outline" onClick={() => finish("recall", false)}>没想起来</Button><Button onClick={() => finish("recall", true)}>想起来了</Button></div></>}
    {error && <p role="alert" className="mt-4 text-rose-700">{error}</p>}</CardContent></Card></main>;
}
function nextView(targets: DailyTargetSnapshot[], session: TodaySessionDTO): View { const block = session.currentBlock ?? 1; const target = targets.find((w) => w.block === block && session.targetProgress?.[w.wordId]?.status === "active") ?? targets.find((w) => w.block === block && !session.completedTargetIds?.includes(w.wordId)); return target ? session.targetProgress?.[target.wordId]?.currentActivity ?? "recognition" : session.completedMiniReviewBlocks?.includes(block) ? "final" : "mini"; }
async function refreshTodaySession(planId: string): Promise<TodaySessionDTO> {
  const response = await fetch(`/api/today/events?planId=${encodeURIComponent(planId)}`, {cache: "no-store"});
  if (!response.ok) throw new Error("TODAY_REFRESH_UNAVAILABLE");
  return response.json() as Promise<TodaySessionDTO>;
}
function RootPreview({ target }: { target: DailyTargetSnapshot }) { return <div className="mt-4 rounded-xl bg-indigo-50 p-3 text-left"><strong>{target.rootForm} · {target.rootMeaningZh.join(" / ")}</strong><p className="text-sm">{target.rootExplanation || target.morphology?.formationExplanation}</p><p className="font-mono text-sm">{target.morphology?.segments.map((s) => s.surfaceForm).join(" + ")}</p></div>; }
