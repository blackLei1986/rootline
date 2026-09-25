import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { ProgressDashboard } from "@/components/progress-dashboard";
import { getOptionalViewer } from "@/lib/auth/session";
import { createProductionProgressService } from "@/lib/progress/server";
import type {ProgressDashboardDTO} from "@/lib/progress/types";

export const metadata: Metadata = { title: "学习进度", description: "查看稳定掌握的词汇、今日学习连续性、词根掌握和真实增长记录。" };

export default async function ProgressPage() {
  // Account-scoped metrics and today's observation must run for each request.
  await connection();
  const viewer = await getOptionalViewer();
  if (!viewer?.emailVerified) return <div className="page-shell py-10 sm:py-14"><section className="rounded-3xl border bg-white px-6 py-12 text-center">
    <h1 className="text-3xl font-bold">{viewer ? "验证邮箱后查看学习进度" : "登录后查看学习进度"}</h1>
    <p className="mx-auto mt-3 max-w-xl text-[var(--muted-foreground)]">学习进度只展示与你的已验证账号关联的数据。</p>
    <Link href="/login?next=%2Fprogress" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white">登录或验证邮箱</Link>
  </section></div>;
  let dashboard: ProgressDashboardDTO;
  try {
    dashboard = await createProductionProgressService().getDashboard(viewer.userId, new Date());
  } catch {
    return <div className="page-shell py-10 sm:py-14"><section role="alert" className="rounded-3xl border bg-white px-6 py-12 text-center">
      <h1 className="text-2xl font-bold">学习进度暂时不可用</h1>
      <p className="mt-3 text-[var(--muted-foreground)]">你的数据没有被清零。请稍后重试。</p>
      <Link href="/progress" className="mt-5 inline-flex min-h-11 items-center rounded-xl border px-5 py-2 text-sm font-semibold">重试</Link>
    </section></div>;
  }
  return <ProgressDashboard dashboard={dashboard} />;
}
