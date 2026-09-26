import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/(auth)/actions";
import { requestPasswordResetAction } from "@/app/settings/account/actions";
import { AccountSettingsForm, TimeZoneSettingsForm } from "@/components/account-settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentAccount } from "@/lib/auth/account";
import { ProductState } from "@/components/product-state";
import { AuthBoundaryError } from "@/types/auth";
import { getOptionalViewer } from "@/lib/auth/session";
import { BetaParticipantControls } from "@/components/beta/beta-participant-controls";

export const metadata: Metadata = { title: "账号设置" };
export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  let account;
  let viewer: Awaited<ReturnType<typeof getOptionalViewer>> = null;
  try {
    account = await getCurrentAccount();
    viewer = await getOptionalViewer();
  } catch (error) {
    if (error instanceof AuthBoundaryError) redirect("/login?next=%2Fsettings%2Faccount");
    return <main className="page-shell py-10"><ProductState title="账号设置暂时无法加载" description="请稍后重试；你的设置不会因此丢失。" actionHref="/settings/account" actionLabel="重试" variant="error" /></main>;
  }

  return <div className="page-shell max-w-3xl py-10 sm:py-14"><h1 className="text-4xl font-bold tracking-[-0.04em]">Me · 账号设置</h1><p className="mt-3 text-[var(--muted-foreground)]">管理个人信息、学习时区和登录安全。</p><div className="mt-8 grid gap-5"><Card><CardContent className="p-6"><h2 className="text-lg font-bold">个人信息</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">登录邮箱：{account.email}</p><div className="mt-5"><AccountSettingsForm displayName={account.displayName} /></div></CardContent></Card><Card><CardContent className="p-6"><h2 className="text-lg font-bold">学习偏好</h2><p className="mt-2 text-sm">当前时区：{account.timeZone}</p><p className="mt-2 text-sm">已设置的每日学习时间：{account.dailyTimeBudget} 分钟</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">每日学习时间由现有学习设置决定，此处仅供查看。</p><div className="mt-5"><TimeZoneSettingsForm timeZone={account.timeZone} /></div></CardContent></Card><Card><CardContent className="p-6"><h2 className="text-lg font-bold">登录安全</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">密码重置链接会发送到当前邮箱。</p><div className="mt-5 flex flex-wrap gap-3"><form action={requestPasswordResetAction}><Button type="submit" variant="outline">发送密码重置邮件</Button></form><form action={logoutAction}><Button type="submit" variant="outline">退出登录</Button></form></div></CardContent></Card>{viewer?.emailVerified && <BetaParticipantControls userId={viewer.userId} />}</div></div>;
}
