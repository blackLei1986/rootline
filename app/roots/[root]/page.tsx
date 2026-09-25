import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {connection} from "next/server";
import {getOptionalViewer} from "@/lib/auth/session";
import {getRootById} from "@/data/roots";
import {loadTrustedRootDirectory} from "@/lib/roots/server";

export async function generateMetadata({params}: {params: Promise<{root: string}>}): Promise<Metadata> {
  const {root} = await params;
  return {title: `${root} · 可信词根`};
}

export default async function RootDetailPage({params}: {params: Promise<{root: string}>}) {
  await connection();
  const {root} = await params;
  const viewer = await getOptionalViewer();
  const {rows, words, personal} = await loadTrustedRootDirectory(viewer?.emailVerified ? viewer.userId : null);
  const row = rows.find((entry) => entry.rootKey === root);
  if (!row) notFound();
  const copy = getRootById(root);
  return <main className="page-shell max-w-4xl py-10 sm:py-14">
    <Link href="/roots" className="text-sm font-semibold text-[var(--primary)]">← 返回词根目录</Link>
    <p className="mt-8 text-xs font-bold uppercase text-[var(--primary)]">已核验词根</p>
    <h1 className="mt-2 text-5xl font-bold">{root}</h1>
    {copy && <><p className="mt-3 text-lg">{copy.meaningZh.join(" · ")}</p><p className="mt-3 text-[var(--muted-foreground)]">{copy.description}</p></>}
    <p className="mt-5 text-sm">已核验关联 {row.usable} 词{personal ? ` · 已学习 ${row.learned} · 稳定掌握 ${row.stable}` : ""}</p>
    <h2 className="mt-10 text-xl font-bold">关联词汇</h2>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{row.wordIds.map((id) => {const word = words.get(id); return <Link key={id} href={`/vocabulary/catalog/${encodeURIComponent(id)}`} className="rounded-xl border bg-white p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><span className="font-semibold">{word?.word ?? id}</span><span className="ml-3 text-sm text-[var(--muted-foreground)]">{word?.coreMeaningZh}</span></Link>;})}</div>
  </main>;
}
