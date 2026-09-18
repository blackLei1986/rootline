"use client";

import Link from "next/link";
import { LogOut, Settings, UserRound } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import type { AccountDTO } from "@/lib/auth/account-dto";

export function AccountMenu({ account }: { account: AccountDTO | null }) {
  if (!account) {
    return <div className="flex items-center gap-1"><Link href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--muted-foreground)] hover:bg-[var(--muted)]">登录</Link><Link href="/register" className="rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white">创建账号</Link></div>;
  }

  return (
    <details className="group relative">
      <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]" aria-label="账号菜单"><UserRound className="size-5" /></summary>
      <div className="absolute right-0 mt-2 w-64 rounded-2xl border bg-white p-2 shadow-xl">
        <div className="border-b px-3 py-2"><p className="truncate text-sm font-semibold">{account.displayName ?? "Rootline 学习者"}</p><p className="truncate text-xs text-[var(--muted-foreground)]">{account.email}</p></div>
        <Link href="/settings/account" className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-[var(--muted)]"><Settings className="size-4" />账号设置</Link>
        <form action={logoutAction}><button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"><LogOut className="size-4" />退出登录</button></form>
      </div>
    </details>
  );
}
