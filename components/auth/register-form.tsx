"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_ACTION_STATE } from "@/lib/auth/action-state";
import { AuthField, AuthMessage } from "@/components/auth/form-fields";
import { Button } from "@/components/ui/button";

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(registerAction, INITIAL_AUTH_ACTION_STATE);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <AuthField label="邮箱" name="email" type="email" autoComplete="email" error={state.fieldErrors?.email} />
      <AuthField label="密码" name="password" type="password" autoComplete="new-password" error={state.fieldErrors?.password} />
      <AuthField label="确认密码" name="confirmPassword" type="password" autoComplete="new-password" error={state.fieldErrors?.confirmPassword} />
      <AuthMessage state={state} />
      <Button type="submit" className="w-full" size="lg" disabled={pending}>{pending ? "正在创建…" : "创建账号"}</Button>
      <p className="text-center text-sm text-[var(--muted-foreground)]">已有账号？ <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-[var(--primary)]">直接登录</Link></p>
    </form>
  );
}
