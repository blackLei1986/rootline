"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { hydrateAuthoritativeWordState } from "@/lib/storage";
import { flushSyncQueue, listPendingWordOperations } from "@/lib/sync/offline-queue";
import type { PublicSession, ReadingOutcome } from "@/lib/reading/reinforcement/types";
import type { WordProgress } from "@/types/progress";
import { recordBetaEvent } from "@/lib/beta/validation-store";

export function ReadingReinforcement({initialSession, betaUserId}: {initialSession: PublicSession; betaUserId?: string}) {
  const [session, setSession] = useState(initialSession);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<ReadingOutcome | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const answerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!betaUserId) return;
    if (session.status !== "complete") {
      recordBetaEvent(betaUserId, session.learningDate, {type: "reading-observed", sessionId: session.id});
      return;
    }
    const latestAnswer = session.outcomes.map((item) => Date.parse(item.answeredAt)).filter(Number.isFinite).sort((a, b) => b - a)[0];
    const today = latestAnswer === undefined ? new Date() : new Date(latestAnswer);
    const learningDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    recordBetaEvent(betaUserId, learningDate, {type: "reading-completed", sessionId: session.id});
  }, [betaUserId, session]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = session.currentQuestion;
    if (!question || !answer.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      if (listPendingWordOperations(question.wordId).length > 0) {
        const result = await flushSyncQueue();
        if (listPendingWordOperations(question.wordId).length > 0) {
          setError(result.conflict ? "本地同步冲突：原修改已保留。请先处理同步提示，再重试答案。"
            : "本地修改尚未同步，答案未提交。请联网后重试。");
          answerRef.current?.focus();
          return;
        }
      }
      const response = await fetch(`/api/reading/reinforcement/${encodeURIComponent(session.id)}/answers`, {
        method: "POST", headers: {"content-type": "application/json"},
        body: JSON.stringify({questionId: question.id, answer: answer.trim()})
      });
      if (response.status === 409) {
        setError("练习进度已在其他页面更新。答案未计入，请刷新进度后继续。");
        answerRef.current?.focus();
        return;
      }
      if (!response.ok) throw new Error("Reading answer unavailable.");
      const body = await response.json() as {session: PublicSession; wordState: WordProgress | null};
      const outcome = body.session.outcomes.find((item) => item.questionId === question.id);
      if (!outcome) throw new Error("Confirmed answer is missing.");
      if (body.wordState?.wordId === question.wordId) hydrateAuthoritativeWordState(question.wordId, body.wordState);
      setSession(body.session);
      setFeedback(outcome);
      setAnswer("");
      requestAnimationFrame(() => headingRef.current?.focus());
    } catch {
      setError("答案未保存，输入仍在。请检查网络后重试。");
      answerRef.current?.focus();
    } finally { setBusy(false); }
  }

  const question = session.currentQuestion;
  return <main className="page-shell max-w-3xl py-8 sm:py-12">
    <Link href="/reading" className="text-sm font-semibold text-[var(--primary)] underline">返回今日阅读</Link>
    <header className="mt-7"><p className="label-caps text-xs font-bold text-[var(--primary)]">Optional Reading Practice</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">阅读词汇巩固</h1>
      <p className="mt-3 text-sm text-[var(--muted-foreground)]">这组题来自已读摘要；不计入 Daily 30 完成条件。</p>
      <p className="mt-4 font-semibold" aria-live="polite">已练习 {session.practiced} 个词 · 答对 {session.correct} 个词</p>
    </header>
    {feedback && <section aria-live="polite" className="mt-6 rounded-2xl border bg-emerald-50 p-4">
      <p className="font-semibold">{feedback.correct ? "回答正确" : "这次未答对"}</p>
      <p className="mt-1 text-sm">参考答案：{feedback.correctDisplay}</p>
    </section>}
    {session.status === "complete" || !question ? <section className="mt-8 rounded-3xl border bg-white p-6">
      <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">已完成 {session.practiced} 个词</h2>
      <p className="mt-3">答对 {session.correct} / {session.total}。结果已保存，回访时不会再次计分。</p>
      <Link href="/reading" className="mt-5 inline-block underline">返回今日阅读</Link>
    </section> : <section className="mt-8 rounded-3xl border bg-white p-5 sm:p-8">
      <p className="text-sm font-semibold text-[var(--primary)]">第 {session.cursor + 1} / {session.total} 题</p>
      <h2 ref={headingRef} tabIndex={-1} className="mt-3 text-xl font-bold outline-none">{question.prompt}</h2>
      <blockquote className="mt-5 whitespace-pre-wrap break-words rounded-2xl bg-[var(--primary-soft)] p-4 text-lg leading-8">{question.context}</blockquote>
      <form className="mt-6" onSubmit={(event) => void submit(event)}>
        {question.type === "recognition" && question.choices?.length ? <fieldset>
          <legend className="font-semibold">你的答案</legend>
          <div className="mt-3 grid gap-2">{question.choices.map((choice) => <label key={choice} className="flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2">
            <input ref={answer === choice ? answerRef : undefined} type="radio" name="reading-answer" value={choice} checked={answer === choice}
              onChange={() => setAnswer(choice)} />{choice}</label>)}</div>
        </fieldset> : <label className="block font-semibold">你的答案
          <input ref={answerRef} type="text" value={answer} onChange={(event) => setAnswer(event.target.value)}
            autoComplete="off" className="mt-3 block min-h-12 w-full rounded-xl border bg-white px-4 py-2 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]" />
        </label>}
        {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={busy || !answer.trim()} className="mt-5 min-h-11 rounded-xl bg-[var(--primary)] px-6 py-2 font-semibold text-white disabled:opacity-60">{busy ? "正在保存…" : "提交答案"}</button>
      </form>
    </section>}
  </main>;
}
