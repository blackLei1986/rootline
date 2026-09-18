import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/(auth)/actions";
import { requestPasswordResetAction } from "@/app/settings/account/actions";
import { AccountSettingsForm } from "@/components/account-settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentAccount } from "@/lib/auth/account";

export const metadata: Metadata = { title: "账号设置" };
export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  let account;
  try {
    account = await getCurrentAccount();
  } catch {
    redirect("/login?next=%2Fsettings%2Faccount");
  }

  return <div className="page-shell max-w-3xl py-10 sm:py-14"><h1 className="text-4xl font-bold tracking-[-0.04em]">账号设置</h1><p className="mt-3 text-[var(--muted-foreground)]">管理个人显示信息和登录安全。</p><div className="mt-8 grid gap-5"><Card><CardContent className="p-6"><h2 className="text-lg font-bold">个人信息</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">登录邮箱：{account.email}</p><div className="mt-5"><AccountSettingsForm displayName={account.displayName} /></div></CardContent></Card><Card><CardContent className="p-6"><h2 className="text-lg font-bold">登录安全</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">密码重置链接会发送到当前邮箱。</p><div className="mt-5 flex flex-wrap gap-3"><form action={requestPasswordResetAction}><Button type="submit" variant="outline">发送密码重置邮件</Button></form><form action={logoutAction}><Button type="submit" variant="outline">退出登录</Button></form></div></CardContent></Card></div></div>;
}
