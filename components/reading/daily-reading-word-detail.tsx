import type { HighlightLevel } from "@/lib/reading/daily-reading-highlights";
import type { DailyTargetSnapshot } from "@/types/today";

export interface DailyReadingWordDetailData {
  wordId: string; word: string; lemma: string; coreMeaningZh: string; coreDefinitionEn: string;
  phonetic?: string; example?: string; morphology: DailyTargetSnapshot["morphology"];
  rootForm?: string | null; rootMeaningEn?: string[]; rootMeaningZh?: string[]; rootExplanation?: string | null;
}

export function DailyReadingWordDetail({ word, level, onClose, dialogRef }: { word: DailyReadingWordDetailData; level: HighlightLevel; onClose(): void; dialogRef: React.RefObject<HTMLDivElement | null> }) {
  const levelText = level === "today" ? "今日词" : level === "recent-7-day" ? "近 7 日词" : "近期词";
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="daily-reading-word-title" tabIndex={-1} onKeyDown={(event) => { if (event.key === "Escape") onClose(); if (event.key === "Tab") { event.preventDefault(); event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus(); } }} className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl outline-none sm:rounded-3xl sm:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--primary)]">{levelText}</p><h2 id="daily-reading-word-title" className="mt-1 text-3xl font-bold">{word.word}</h2></div><button type="button" aria-label="关闭词汇详情" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">关闭</button></div>
      {word.phonetic && <p className="mt-2 text-sm text-[var(--muted-foreground)]">/{word.phonetic}/</p>}
      <p className="mt-5 text-xl font-semibold">{word.coreMeaningZh || word.lemma}</p>
      {word.coreDefinitionEn && <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{word.coreDefinitionEn}</p>}
      {word.morphology && <section className="mt-5 rounded-2xl bg-[var(--primary-soft)] p-4" aria-label="可信形态信息"><h3 className="font-semibold">词形构成</h3>{word.rootForm && <p className="mt-2">词根 {word.rootForm}{word.rootMeaningZh?.length ? `：${word.rootMeaningZh.join("、")}` : ""}</p>}<ul className="mt-2 flex flex-wrap gap-2 text-sm">{word.morphology.segments.map((segment, index) => <li key={`${segment.kind}-${index}`} className="rounded-lg border bg-white px-2 py-1">{segment.kind === "root" ? "词根" : segment.kind === "prefix" ? "前缀" : "后缀"} {segment.surfaceForm}{segment.meaning ? ` · ${segment.meaning}` : ""}</li>)}</ul>{word.morphology.formationExplanation && <p className="mt-3 text-sm leading-6">{word.morphology.formationExplanation}</p>}</section>}
      {word.example && <p className="mt-5 border-t pt-4 text-sm leading-6"><span className="font-semibold">语境：</span>{word.example}</p>}
    </div>
  </div>;
}
