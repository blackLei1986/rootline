import Link from "next/link";
import type {CompletionWindow, ProgressDashboardDTO, ProgressDay} from "@/lib/progress/types";
import type {RootMasteryRow} from "@/lib/progress/roots";

const number = (value: number) => value.toLocaleString("en-US");
const dayLabel: Record<ProgressDay["state"], string> = {
  complete: "已完成", active: "进行中", "not-started": "未开始", missing: "未生成计划"
};

export function ProgressDashboard({dashboard}: {dashboard: ProgressDashboardDTO}) {
  const roots = [...dashboard.roots].filter((root) => root.usable > 0)
    .sort((a, b) => b.stable - a.stable || b.learned - a.learned || a.rootKey.localeCompare(b.rootKey));
  return <div className="page-shell min-w-0 py-8 pb-24 sm:py-12 md:pb-12">
    <header className="mb-7"><p className="label-caps text-xs font-bold text-[var(--primary)]">Progress 2.0</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">学习进度</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">用已完成的学习和真实复习结果，看见稳步增长。</p></header>
    <section aria-label="稳定掌握" className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-bold">稳定掌握</h2>
      <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">{number(dashboard.vocabulary.stable)} / 10,000</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">10K 目标的 {dashboard.vocabulary.stablePercent.toFixed(1)}%；只计入达到稳定复习标准的词</p>
      <progress className="mt-4 h-3 w-full accent-[var(--primary)]" max={10_000} value={Math.min(dashboard.vocabulary.stable, 10_000)} aria-label="稳定掌握词汇的 10K 进度" />
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:flex sm:gap-6"><p>学习中 <strong>{number(dashboard.vocabulary.learning)}</strong></p><p>接触过 <strong>{number(dashboard.vocabulary.touched)}</strong></p></div>
    </section>
    <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
      <section aria-label="今日学习" className="rounded-3xl border bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">今日学习</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{dashboard.today.date} · {dayLabel[dashboard.today.state]}</p></div>
          <p className="text-sm text-[var(--muted-foreground)]">连续完成 {dashboard.streak} 天</p></div>
        {dashboard.today.required > 0 ? <><p className="mt-4 text-3xl font-bold tabular-nums">{dashboard.today.completed} / {dashboard.today.required}</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">已完成目标 / 冻结目标</p>
          {dashboard.today.required < 30 && <p className="mt-2 text-sm text-amber-800">本日冻结目标少于 30：{dashboard.today.degradationReason ?? "计划仅包含这些可用目标"}</p>}</>
          : <p className="mt-4 text-sm text-[var(--muted-foreground)]">今天尚无冻结学习计划；开始后才会显示目标数。</p>}
        <Link href="/today" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">继续今日学习 →</Link>
      </section>
      <WindowCard title="近 7 日" window={dashboard.last7} strip />
    </div>
    <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
      <WindowCard title="近 30 日" window={dashboard.last30} />
      <section aria-label="词根掌握" className="rounded-3xl border bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold">词根掌握</h2>
        {roots.length ? <ul className="mt-3 space-y-3">{roots.slice(0, 3).map((root) => <RootRow key={root.rootId} root={root} />)}</ul>
          : <p className="mt-3 text-sm text-[var(--muted-foreground)]">暂无可展示的已验证词根关联。</p>}
        {roots.length > 3 && <details className="mt-4 border-t pt-4 text-sm"><summary className="cursor-pointer font-semibold text-[var(--primary)]">查看其他 {roots.length - 3} 个词根</summary>
          <ul className="mt-3 space-y-3">{roots.slice(3).map((root) => <RootRow key={root.rootId} root={root} />)}</ul></details>}
        <p className="mt-4 text-xs leading-5 text-[var(--muted-foreground)]">只统计已审核且已验证的词根关联；一个词可关联多个词根，词根数不可相加当作词汇总数。</p>
      </section>
    </div>
    <section aria-label="词汇增长记录" className="mt-4 rounded-3xl border bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold">词汇增长记录</h2>
      {!dashboard.growth.available ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">增长记录暂不可用；当前稳定掌握数仍可查看，请稍后重试。</p>
        : !dashboard.growth.hasTrend ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">不足两个观测日，暂不绘制趋势。{dashboard.growth.firstObservedDate ? `首个观测日：${dashboard.growth.firstObservedDate}。` : "尚无观测记录。"}</p>
          : <GrowthChart points={dashboard.growth.points} firstObservedDate={dashboard.growth.firstObservedDate} />}
    </section>
    {dashboard.reading && <section aria-label="阅读巩固" className="mt-4 rounded-3xl border bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold">阅读巩固</h2><p className="mt-2 text-2xl font-bold tabular-nums">{dashboard.reading.completedPracticeSessions7d} 次</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">近 7 个学习日文章的已完成词汇巩固；不计入今日学习完成。</p>
    </section>}
  </div>;
}

function WindowCard({title, window, strip = false}: {title: string; window: CompletionWindow; strip?: boolean}) {
  return <section aria-label={title} className="min-w-0 rounded-3xl border bg-white p-5 sm:p-6"><h2 className="text-lg font-bold">{title}</h2>
    {window.percent === null ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">尚无可计学习历史；从第一份今日计划开始计算。</p>
      : <><p className="mt-3 text-2xl font-bold tabular-nums">{window.completed} / {window.eligible} 天 <span className="text-base font-medium text-[var(--muted-foreground)]">· {window.percent}%</span></p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">已完成天数 / 可计天数；当日未完成也计入可计天数。</p></>}
    {strip && window.days.length > 0 && <ol className="mt-4 grid min-w-0 grid-cols-7 gap-1" aria-label="近 7 日逐日状态">
      {window.days.map((day) => <li key={day.date} className="min-w-0 rounded-lg bg-[var(--muted)] px-1 py-2 text-center text-[10px] leading-4 sm:text-xs" aria-label={`${day.date} ${dayLabel[day.state]}`}>
        <span className="block tabular-nums">{day.date.slice(5)}</span><span className="block">{dayLabel[day.state]}</span>
      </li>)}</ol>}
  </section>;
}

function RootRow({root}: {root: RootMasteryRow}) {
  return <li className="min-w-0 rounded-xl bg-[var(--muted)] px-3 py-2 text-sm"><div className="flex min-w-0 items-baseline justify-between gap-2">
    <strong className="truncate">{root.rootKey}</strong><span className="shrink-0 tabular-nums">稳定 {root.stable} / {root.usable} · {root.percent ?? "—"}%</span></div>
    <p className="mt-1 text-xs text-[var(--muted-foreground)]">已学习 {root.learned} / {root.usable}{root.weakWordIds.length ? ` · 待巩固：${root.weakWordIds.join("、")}` : ""}</p></li>;
}

function GrowthChart({points, firstObservedDate}: {points: ProgressDashboardDTO["growth"]["points"]; firstObservedDate: string | null}) {
  const values = points.map((point) => point.stable);
  const min = Math.min(...values), max = Math.max(...values), spread = Math.max(1, max - min);
  return <div className="mt-3 min-w-0"><p className="text-sm text-[var(--muted-foreground)]">首个观测日：{firstObservedDate}。只显示实际观测点；缺失日期没有补值，稳定数可能下降。</p>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-3 h-28 w-full" role="img" aria-label={`稳定词汇观测从 ${points[0].date} 的 ${points[0].stable} 个到 ${points.at(-1)!.date} 的 ${points.at(-1)!.stable} 个`}>
      {points.map((point, index) => <circle key={point.date} cx={Math.round(4 + index / (points.length - 1) * 92)} cy={Math.round(84 - (point.stable - min) / spread * 68)} r="2" fill="var(--primary)" />)}</svg>
    <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">{points.map((point) => <li key={point.date}>{point.date}: {point.stable}</li>)}</ol></div>;
}
