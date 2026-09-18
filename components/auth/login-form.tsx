"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_ACTION_STATE } from "@/lib/auth/action-state";
import { AuthField, AuthMessage } from "@/components/auth/form-fields";
import { Button } from "@/components/ui/button";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, INITIAL_AUTH_ACTION_STATE);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <AuthField label="邮箱" name="email" type="email" autoComplete="email" error={state.fieldErrors?.email} />
      <AuthField label="密码" name="password" type="password" autoComplete="current-password" error={state.fieldErrors?.password} />
      <AuthMessage state={state} />
      <Button type="submit" className="w-full" size="lg" disabled={pending}>{pending ? "正在登录…" : "登录"}</Button>
      <div className="flex justify-between text-sm"><Link href="/forgot-password" className="text-[var(--primary)]">忘记密码</Link><Link href={`/register?next=${encodeURIComponent(next)}`} className="text-[var(--primary)]">创建账号</Link></div>
    </form>
  );
}
