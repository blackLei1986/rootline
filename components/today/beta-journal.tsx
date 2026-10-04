"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { readBetaLog, recordBetaEvent } from "@/lib/beta/validation-store";
import { useBetaParticipation } from "@/lib/beta/use-beta-participation";

type RatingKey = "difficulty" | "fatigue" | "rootUsefulness" | "reviewUsefulness";
const ratingQuestions: Array<{key: RatingKey; label: string}> = [
  {key: "difficulty", label: "难度"}, {key: "fatigue", label: "疲劳"},
  {key: "rootUsefulness", label: "词根帮助"}, {key: "reviewUsefulness", label: "复习帮助"},
];

export function BetaJournal(props: {userId: string; learningDate: string}) {
  return <BetaJournalForm key={`${props.userId}:${props.learningDate}`} {...props} />;
}

function BetaJournalForm({userId, learningDate}: {userId: string; learningDate: string}) {
  const [dismissed, setDismissed] = useState(false);
  const [saved, setSaved] = useState(false);
  const previous = readBetaLog(userId).days.find((day) => day.learningDate === learningDate)?.journal;
  const [ratings, setRatings] = useState<Partial<Record<RatingKey, number>>>(previous?.ratings ?? {});
  const [continueTomorrow, setContinueTomorrow] = useState<boolean | null>(previous?.continueTomorrow ?? null);
  const [note, setNote] = useState(previous?.note ?? "");
  const participating = useBetaParticipation(userId);
  if (!participating || dismissed || saved) return null;
  function submit() {
    if (ratingQuestions.some(({key}) => !ratings[key]) || continueTomorrow === null) return;
    recordBetaEvent(userId, learningDate, {type: "journal", ratings: ratings as Required<typeof ratings>, continueTomorrow, note});
    setSaved(true);
  }
  return <Card className="mt-5"><CardContent className="p-6"><h2 className="text-lg font-bold">Beta 日记（可跳过）</h2>
    {ratingQuestions.map(({key, label}) => <fieldset key={key} className="mt-4"><legend className="text-sm font-semibold">{label}（1–5）</legend><div className="mt-2 flex gap-3">{[1, 2, 3, 4, 5].map((value) => <label key={value} className="inline-flex items-center gap-1"><input type="radio" name={`beta-${key}`} aria-label={`${label} ${value}`} checked={ratings[key] === value} onChange={() => setRatings((current) => ({...current, [key]: value}))} />{value}</label>)}</div></fieldset>)}
    <fieldset className="mt-4"><legend className="text-sm font-semibold">明天愿意继续吗？</legend><div className="mt-2 flex gap-5"><label className="inline-flex items-center gap-2"><input type="radio" name="beta-continue" aria-label="明天继续" checked={continueTomorrow === true} onChange={() => setContinueTomorrow(true)} />愿意</label><label className="inline-flex items-center gap-2"><input type="radio" name="beta-continue" aria-label="明天不继续" checked={continueTomorrow === false} onChange={() => setContinueTomorrow(false)} />不愿意</label></div></fieldset>
    <label className="mt-4 block text-sm font-semibold" htmlFor="beta-journal-note">今天最不舒服的地方是什么？（可选）</label><p className="mt-1 text-xs text-[var(--muted-foreground)]">请勿填写词条答案、文章标题或个人信息；自动过滤无法识别所有自由文本内容。</p><textarea id="beta-journal-note" aria-label="最不舒服的地方" maxLength={500} value={note} onChange={(event) => setNote(event.target.value.slice(0, 500))} className="mt-2 min-h-24 w-full rounded-xl border p-3 text-sm" />
    <div className="mt-4 flex gap-3"><button type="button" disabled={ratingQuestions.some(({key}) => !ratings[key]) || continueTomorrow === null} onClick={submit} className="min-h-11 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">保存反馈</button><button type="button" onClick={() => setDismissed(true)} className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold">跳过反馈</button></div>
  </CardContent></Card>;
}
