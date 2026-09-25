import type {Metadata} from "next";
import Link from "next/link";
import {connection} from "next/server";
import {getOptionalViewer} from "@/lib/auth/session";
import {getRootById} from "@/data/roots";
import {loadTrustedRootDirectory} from "@/lib/roots/server";

export const metadata: Metadata = {title: "可信词根目录"};

export default async function RootsPage() {
  await connection();
  const viewer = await getOptionalViewer();
  const {rows, personal} = await loadTrustedRootDirectory(viewer?.emailVerified ? viewer.userId : null);
  return <main className="page-shell max-w-5xl py-10 sm:py-14">
    <p className="text-xs font-bold uppercase text-[var(--primary)]">Roots</p>
    <h1 className="mt-2 text-3xl font-bold sm:text-4xl">可信词根目录</h1>
    <p className="mt-3 max-w-2xl text-[var(--muted-foreground)]">只展示已发布并核验的词根关系；课程示例不会自动成为学习证据。</p>
    {rows.length === 0 ? <section role="status" className="mt-8 rounded-2xl border bg-white p-6"><h2 className="text-xl font-semibold">暂无已核验词根</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">词根资料仍在核验中。你可以先继续今日学习。</p><Link href="/today" className="mt-4 inline-block font-semibold text-[var(--primary)]">前往 Today</Link></section>
      : <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((row) => {const copy = getRootById(row.rootKey); return <Link key={row.rootKey} href={`/roots/${encodeURIComponent(row.rootKey)}`} className="rounded-2xl border bg-white p-5 transition-colors hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><h2 className="text-2xl font-bold">{row.rootKey}</h2>{copy && <p className="mt-1 text-sm text-[var(--muted-foreground)]">{copy.meaningZh.join(" · ")}</p>}<p className="mt-4 text-sm">已核验关联 {row.usable} 词</p>{personal && <p className="mt-2 text-sm text-[var(--muted-foreground)]">已学习 {row.learned} · 稳定掌握 {row.stable}</p>}</Link>;})}</div>}
  </main>;
}
