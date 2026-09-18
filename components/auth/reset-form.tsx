"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_ACTION_STATE } from "@/lib/auth/action-state";
import { AuthField, AuthMessage } from "@/components/auth/form-fields";
import { Button } from "@/components/ui/button";

export function ResetForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, INITIAL_AUTH_ACTION_STATE);
  return <form action={action} className="space-y-4"><AuthField label="新密码" name="password" type="password" autoComplete="new-password" error={state.fieldErrors?.password} /><AuthField label="确认新密码" name="confirmPassword" type="password" autoComplete="new-password" error={state.fieldErrors?.confirmPassword} /><AuthMessage state={state} /><Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "正在更新…" : "更新密码"}</Button></form>;
}
