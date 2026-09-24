import { getHighlightLabel, type SummaryToken } from "@/lib/reading/daily-reading-highlights";

export function DailyReadingSummary({ tokens, onSelectWord }: { tokens: readonly SummaryToken[]; onSelectWord(wordId: string, trigger: HTMLButtonElement): void }) {
  return <article aria-label="文章摘要" className="mt-8 rounded-3xl border bg-white px-5 py-6 sm:px-8 sm:py-9">
    <h2 className="text-lg font-bold">摘要</h2>
    <p className="mt-5 select-text whitespace-pre-wrap text-lg leading-9 text-[var(--foreground)] sm:text-xl sm:leading-10">
      {tokens.map((token, index) => {
        if (!token.wordId || !token.level) return <span key={`text-${index}`}>{token.text}</span>;
        const label = getHighlightLabel(token.level);
        const today = token.level === "today";
        return <button key={`word-${index}`} type="button" aria-haspopup="dialog" aria-label={`${token.text}，${label}`} onClick={(event) => onSelectWord(token.wordId!, event.currentTarget)} className={`select-text rounded-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${today ? "underline decoration-2 underline-offset-4" : "underline decoration-dotted decoration-2 underline-offset-4"}`}>{token.text}</button>;
      })}
    </p>
    <p className="mt-5 border-t pt-4 text-xs text-[var(--muted-foreground)]">下划线样式区分今日词与近期词；点击可查看词义。</p>
  </article>;
}
